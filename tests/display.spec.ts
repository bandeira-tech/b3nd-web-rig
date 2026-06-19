import { expect, test } from "./fixtures";

// Window-side helpers exposed by main.tsx. Mirroring the runtime shape so the
// tests don't need to import the app source.
type DisplayHint = {
  kind:
    | "json"
    | "text"
    | "markdown"
    | "image"
    | "html"
    | "binary"
    | "unknown";
  contentType?: string;
  extension?: string;
  payload: unknown;
};

declare global {
  interface Window {
    __b3ndDisplay?: {
      deriveHint(input: { uri?: string; data: unknown }): DisplayHint;
      registry: { list(): Array<{ id: string; kinds: string[] }> };
    };
  }
}

test.describe("display hint derivation", () => {
  test("registry exposes the default strategies", async ({ app }) => {
    const ids = await app.evaluate(() =>
      window.__b3ndDisplay!.registry.list().map((s) => s.id)
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "core.json",
        "core.text",
        "core.markdown",
        "core.image",
        "core.html",
        "core.binary",
        "core.unknown",
      ]),
    );
  });

  test("object payload → json hint", async ({ app }) => {
    const hint = await app.evaluate(() =>
      window.__b3ndDisplay!.deriveHint({
        uri: "mutable://demo/profile",
        data: { name: "alice" },
      })
    );
    expect(hint.kind).toBe("json");
    expect((hint.payload as { name?: string }).name).toBe("alice");
  });

  test("JSON string is parsed even without an extension", async ({ app }) => {
    const hint = await app.evaluate(() =>
      window.__b3ndDisplay!.deriveHint({
        uri: "mutable://demo/snapshot",
        data: '{"ok":true,"n":1}',
      })
    );
    expect(hint.kind).toBe("json");
    expect(hint.payload).toEqual({ ok: true, n: 1 });
  });

  test(".md extension wins as markdown", async ({ app }) => {
    const hint = await app.evaluate(() =>
      window.__b3ndDisplay!.deriveHint({
        uri: "mutable://notes/hello.md",
        data: "## hello\n\nworld",
      })
    );
    expect(hint.kind).toBe("markdown");
    expect(hint.payload).toContain("hello");
  });

  test("string with heading sniffs as markdown when no extension", async ({ app }) => {
    const hint = await app.evaluate(() =>
      window.__b3ndDisplay!.deriveHint({
        uri: "mutable://notes/loose",
        data: "# Top\n\nbody",
      })
    );
    expect(hint.kind).toBe("markdown");
  });

  test("plain text falls back to text kind", async ({ app }) => {
    const hint = await app.evaluate(() =>
      window.__b3ndDisplay!.deriveHint({
        uri: "mutable://x/log.txt",
        data: "no markdown here",
      })
    );
    expect(hint.kind).toBe("text");
    expect(hint.extension).toBe("txt");
  });

  test("data: URL is detected as image", async ({ app }) => {
    const hint = await app.evaluate(() =>
      window.__b3ndDisplay!.deriveHint({
        uri: "mutable://media/dot.png",
        data:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=",
      })
    );
    expect(hint.kind).toBe("image");
    expect(hint.contentType).toBe("image/png");
  });

  test("Uint8Array of PNG-extension URI becomes an image data URL", async ({ app }) => {
    const hint = await app.evaluate(() => {
      // 1x1 transparent PNG.
      const bytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      ]);
      return window.__b3ndDisplay!.deriveHint({
        uri: "mutable://media/dot.png",
        data: bytes,
      });
    });
    expect(hint.kind).toBe("image");
    expect(String(hint.payload)).toMatch(/^data:image\/png;base64,/);
  });

  test("Uint8Array of valid utf-8 JSON decodes through to a json hint", async ({ app }) => {
    const hint = await app.evaluate(() => {
      const enc = new TextEncoder();
      return window.__b3ndDisplay!.deriveHint({
        uri: "mutable://demo/profile.json",
        data: enc.encode('{"name":"bob"}'),
      });
    });
    expect(hint.kind).toBe("json");
    expect((hint.payload as { name?: string }).name).toBe("bob");
  });

  test("invalid utf-8 bytes route to binary", async ({ app }) => {
    const hint = await app.evaluate(() => {
      // 0xff 0xfe is invalid as a UTF-8 start sequence in fatal mode.
      const bytes = new Uint8Array([0xff, 0xfe, 0xff]);
      return window.__b3ndDisplay!.deriveHint({
        uri: "mutable://blob/raw",
        data: bytes,
      });
    });
    expect(hint.kind).toBe("binary");
  });

  test("envelope contentType is preserved on the hint", async ({ app }) => {
    const hint = await app.evaluate(() =>
      window.__b3ndDisplay!.deriveHint({
        uri: "mutable://x/y",
        data: { _meta: { contentType: "application/vnd.b3nd.note+json" }, body: 1 },
      })
    );
    expect(hint.kind).toBe("json");
    expect(hint.contentType).toBe("application/vnd.b3nd.note+json");
  });
});

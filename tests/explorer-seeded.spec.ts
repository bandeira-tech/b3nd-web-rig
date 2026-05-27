import { expect, test } from "./fixtures";

test.describe("explorer (seeded)", () => {
  // BLOCKED on schema reporting. After the b3nd-core 0.22 / b3nd-save split,
  // the BYTES_ENTITY-backed MemoryStore reports `entity:<name>` in
  // status().schema rather than per-URI prefixes. The explorer's schema-
  // driven nav still parses prefixes by `protocol://host` so seeded writes
  // no longer surface as "mutable://demo" branches. Needs either a schema
  // adapter in the host or a Store mode that retains URI prefixes.
  test.fixme("shows a seeded record under its protocol root", async ({ app, rig }) => {
    await rig.seed([
      ["mutable://demo/note", { title: "hello", body: "world" }],
    ]);

    await app.getByRole("button", { name: /Explorer/ }).click();
    await expect(app).toHaveURL(/\/explorer/);

    // Schema-driven root nav: "mutable://demo" should now appear.
    await expect(app.getByText("mutable://demo")).toBeVisible();
  });

  // BLOCKED on HttpAdapter.listPath — see notes in the test below.
  test.fixme(
    "multiple records under the same prefix list together",
    async ({ app, rig }) => {
      await rig.seed([
        ["mutable://demo/a", { v: 1 }],
        ["mutable://demo/b", { v: 2 }],
        ["mutable://demo/c", { v: 3 }],
      ]);

      await app.goto("/explorer/mutable/demo");

      await expect(app.getByText("a", { exact: true })).toBeVisible();
      await expect(app.getByText("b", { exact: true })).toBeVisible();
      await expect(app.getByText("c", { exact: true })).toBeVisible();
    },
  );

  // BLOCKED on HttpAdapter.listPath. The adapter calls client.read("uri/")
  // and pulls `results[0].record.data` expecting a wrapped {uri,type}[]
  // listing — but b3nd-core 0.14's HttpClient and MemoryStore both return
  // ReadResult[] (one entry per leaf URI). On a leaf path with no children,
  // the result array is empty and listPath throws "no result" instead of
  // letting ContentViewer fall back to readRecord.
  test.fixme("opening a seeded record renders its JSON data", async ({ app, rig }) => {
    await rig.seed([
      ["mutable://demo/note", { title: "hello", body: "world" }],
    ]);

    await app.goto("/explorer/mutable/demo/note");

    await expect(app.getByText("Record Data")).toBeVisible();
    await expect(app.getByText("hello")).toBeVisible();
    await expect(app.getByText("world")).toBeVisible();
  });
});

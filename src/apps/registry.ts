import type { AppDescriptor, BuiltinApp } from "./types";
import { notesApp } from "./builtin/NotesApp";
import { bookmarksApp } from "./builtin/BookmarksApp";
import { filesApp } from "./builtin/FilesApp";
import { inboxApp } from "./builtin/InboxApp";

/**
 * Built-in apps — the React components the rig itself ships. Apps stored
 * on b3nd reference these by id under `display: { kind: "builtin", id }`.
 *
 * `appsCatalog` is the seed list shown in the Apps browser when the user
 * hasn't published any of their own. Users can later publish new
 * AppDescriptor records at the configured catalog basepath; those
 * supplement the catalog shown here.
 */
const builtins = new Map<string, BuiltinApp>();

function registerBuiltin(app: BuiltinApp): void {
  builtins.set(app.id, app);
}

registerBuiltin(notesApp);
registerBuiltin(bookmarksApp);
registerBuiltin(filesApp);
registerBuiltin(inboxApp);

export function getBuiltinApp(id: string): BuiltinApp | undefined {
  return builtins.get(id);
}

export function listBuiltinApps(): BuiltinApp[] {
  return Array.from(builtins.values());
}

export const defaultAppCatalog: AppDescriptor[] = [
  {
    slug: "notes",
    name: "Notes",
    description: "A markdown notepad scoped to a basepath you choose.",
    icon: "📝",
    // Behavior-named scheme: `mutable://` says "latest write wins under
    // this identity" — the rule, not the backend. {account?shared} is
    // the identity segment (pubkey when an account is active, the
    // literal "shared" otherwise). The route table on the rig wires the
    // scheme to whichever store enforces the behavior.
    defaultBasePath: "mutable://{account?shared}/notes",
    display: { kind: "builtin", id: "builtin:notes" },
  },
  {
    slug: "bookmarks",
    name: "Bookmarks",
    description: "Stash URLs under your own basepath. One JSON record per link.",
    icon: "🔖",
    defaultBasePath: "mutable://{account?shared}/bookmarks",
    display: { kind: "builtin", id: "builtin:bookmarks" },
  },
  {
    slug: "files",
    name: "Files",
    description: "Drop files of any kind under your basepath. Preview, download, delete.",
    icon: "📁",
    defaultBasePath: "mutable://{account?shared}/files",
    display: { kind: "builtin", id: "builtin:files" },
  },
  {
    slug: "inbox",
    name: "Inbox",
    description: "A timestamped log for thoughts and links — anything that can write a record.",
    icon: "📥",
    defaultBasePath: "mutable://{account?shared}/inbox",
    display: { kind: "builtin", id: "builtin:inbox" },
  },
];

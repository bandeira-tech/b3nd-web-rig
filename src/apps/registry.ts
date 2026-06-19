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
    defaultBasePath: "memory://apps-data/notes",
    display: { kind: "builtin", id: "builtin:notes" },
  },
  {
    slug: "bookmarks",
    name: "Bookmarks",
    description: "Stash URLs under your own basepath. One JSON record per link.",
    icon: "🔖",
    defaultBasePath: "memory://apps-data/bookmarks",
    display: { kind: "builtin", id: "builtin:bookmarks" },
  },
  {
    slug: "files",
    name: "Files",
    description: "Drop files of any kind under your basepath. Preview, download, delete.",
    icon: "📁",
    defaultBasePath: "memory://apps-data/files",
    display: { kind: "builtin", id: "builtin:files" },
  },
  {
    slug: "inbox",
    name: "Inbox",
    description: "A timestamped log for thoughts and links — anything that can write a record.",
    icon: "📥",
    defaultBasePath: "memory://apps-data/inbox",
    display: { kind: "builtin", id: "builtin:inbox" },
  },
];

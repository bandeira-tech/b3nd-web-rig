import type { AppDescriptor, BuiltinApp } from "./types";
import { notesApp } from "./builtin/NotesApp";

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
];

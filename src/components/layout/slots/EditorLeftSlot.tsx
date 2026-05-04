import { EditorNavigation } from "../../editor/EditorNavigation";

export function EditorLeftSlot() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Editor
        </h2>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <EditorNavigation />
      </div>
    </div>
  );
}

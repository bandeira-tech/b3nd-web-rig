import { useAppStore } from "../../stores/appStore";
import { cn } from "../../utils";
import { FileText, Upload } from "lucide-react";
import type { ReactNode } from "react";
import type { EditorSection } from "../../types";

interface SectionEntry {
  id: EditorSection;
  label: string;
  icon: ReactNode;
  hint: string;
}

const sections: SectionEntry[] = [
  {
    id: "text",
    label: "Text",
    icon: <FileText className="h-4 w-4" />,
    hint: "URI + plain payload",
  },
  {
    id: "file",
    label: "File",
    icon: <Upload className="h-4 w-4" />,
    hint: "URI + file bytes",
  },
];

export function EditorNavigation() {
  const editorSection = useAppStore((s) => s.editorSection);
  const setEditorSection = useAppStore((s) => s.setEditorSection);

  return (
    <nav className="p-2 space-y-1">
      {sections.map((s) => {
        const active = editorSection === s.id;
        return (
          <button
            key={s.id}
            onClick={() => setEditorSection(s.id)}
            className={cn(
              "w-full flex items-start gap-3 rounded-md px-3 py-2 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "bg-primary/10 text-primary"
                : "hover:bg-foreground/5 text-foreground",
            )}
          >
            <span className="mt-0.5">{s.icon}</span>
            <span className="flex-1">
              <span className="block text-sm font-medium">{s.label}</span>
              <span className="block text-xs text-muted-foreground">
                {s.hint}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

import { useMemo, useState } from "react";
import {
  CheckCircle,
  Database,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import { HttpAdapter } from "../../adapters/HttpAdapter";
import { connection, Rig } from "@bandeira-tech/b3nd-core/rig";
import { clientForBaseUrl } from "../../services/client";
import { useAppStore } from "../../stores/appStore";

export function SettingsView() {
  return (
    <div className="space-y-4 p-4 max-w-3xl mx-auto">
      <BackendManager />
      <AppInfo />
    </div>
  );
}

export function SettingsSidePanel() {
  const backends = useAppStore((s) => s.backends);
  const activeBackendId = useAppStore((s) => s.activeBackendId);

  const activeBackend = useMemo(
    () => backends.find((b) => b.id === activeBackendId),
    [backends, activeBackendId],
  );

  return (
    <aside className="w-96 border-l border-border bg-card flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Settings Summary</h3>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-4">
        <SummaryCard
          title="Backend"
          icon={<Database className="h-4 w-4" />}
          primary={activeBackend?.name || "None selected"}
          secondary={activeBackend?.adapter.baseUrl || ""}
        />
      </div>
    </aside>
  );
}

function SummaryCard({
  title,
  icon,
  primary,
  secondary,
}: {
  title: string;
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-1 bg-card/80">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      <div className="text-sm text-foreground truncate">{primary}</div>
      {secondary && (
        <div className="text-xs text-muted-foreground truncate">
          {secondary}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded-xl bg-card shadow-sm">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        {icon}
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function BackendManager() {
  const backends = useAppStore((s) => s.backends);
  const activeBackendId = useAppStore((s) => s.activeBackendId);
  const addBackend = useAppStore((s) => s.addBackend);
  const setActiveBackend = useAppStore((s) => s.setActiveBackend);
  const removeBackend = useAppStore((s) => s.removeBackend);

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", baseUrl: "" });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.baseUrl.trim()) return;

    // Build a placeholder rig — addBackend recreates internally with its own rig wiring.
    const client = await clientForBaseUrl(formData.baseUrl);
    const rig = new Rig({
      routes: { receive: [connection(client, ["**"])], read: [connection(client, ["**"])] },
    });
    await addBackend({
      name: formData.name,
      adapter: new HttpAdapter(rig, formData.baseUrl),
      isActive: false,
    });

    setFormData({ name: "", baseUrl: "" });
    setShowAddForm(false);
  };

  return (
    <Section title="Explorer Backend" icon={<Database className="h-4 w-4" />}>
      <p className="text-sm text-muted-foreground">
        Configure the persistence backend used by the rig. Add multiple
        endpoints and pick one as active.
      </p>
      <div className="space-y-2 mb-4">
        {backends.map((backend) => (
          <EndpointItem
            key={backend.id}
            id={backend.id}
            name={backend.name}
            url={backend.adapter.baseUrl || ""}
            isActive={backend.id === activeBackendId}
            onActivate={() => setActiveBackend(backend.id)}
            onRemove={() => removeBackend(backend.id)}
          />
        ))}
      </div>

      {showAddForm
        ? (
          <EndpointForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleAdd}
            onCancel={() => {
              setShowAddForm(false);
              setFormData({ name: "", baseUrl: "" });
            }}
            placeholder="http://localhost:9942"
            cta="Add backend"
          />
        )
        : (
          <AddButton onClick={() => setShowAddForm(true)} label="Add Backend" />
        )}
    </Section>
  );
}

function AppInfo() {
  return (
    <Section title="About" icon={<Info className="h-4 w-4" />}>
      <p className="text-sm text-muted-foreground">
        B3nd Web Rig — generic UI surface for browsing and writing through a
        rig. Protocol-specific UIs ship as plugins.
      </p>
    </Section>
  );
}

function EndpointItem({
  id,
  name,
  url,
  isActive,
  onActivate,
  onRemove,
}: {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  onActivate: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded border p-3 ${
        isActive ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{name}</p>
          {isActive && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded inline-flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> active
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate font-mono">
          {url}
        </p>
      </div>
      {!isActive && (
        <button
          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
          onClick={onActivate}
        >
          Set active
        </button>
      )}
      <button
        className="p-2 text-muted-foreground hover:text-red-500"
        title="Remove"
        onClick={() => {
          if (confirm(`Remove ${name}?`)) onRemove();
        }}
        data-id={id}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function EndpointForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  placeholder,
  cta,
}: {
  formData: { name: string; baseUrl: string };
  setFormData: (v: { name: string; baseUrl: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  placeholder: string;
  cta: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Name"
        className="w-full text-sm bg-background border border-border rounded px-3 py-2"
      />
      <input
        type="text"
        value={formData.baseUrl}
        onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
        placeholder={placeholder}
        className="w-full text-sm font-mono bg-background border border-border rounded px-3 py-2"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {cta}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm rounded border border-border hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded border border-dashed border-border hover:bg-muted"
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}

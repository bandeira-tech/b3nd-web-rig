import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Info,
  Lock,
  Send,
  Upload,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { cn } from "../../utils";
import {
  type BackendClient,
  writeFile,
  writePlain,
} from "../../services/editor/editorService";
import {
  findTokens,
  knownTokens,
  resolveUriTemplate,
} from "../../services/editor/uriTemplate";

const TEMPLATE_PLACEHOLDER = ":account / :hash / :signature";

export function EditorMainContent() {
  const editorSection = useAppStore((s) => s.editorSection);
  const rig = useAppStore((s) => s.rig);
  const identity = useAppStore((s) => s.identity);
  const accounts = useAppStore((s) => s.accounts);
  const activeAccountId = useAppStore((s) => s.activeAccountId);
  const editorOutputs = useAppStore((s) => s.editorOutputs);
  const lastResolvedUri = useAppStore((s) => s.editorLastResolvedUri);
  const setLastResolvedUri = useAppStore((s) => s.setEditorLastResolvedUri);
  const addOutput = useAppStore((s) => s.addEditorOutput);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || null,
    [accounts, activeAccountId],
  );

  if (editorSection === "file") {
    return (
      <Surface
        rig={rig}
        identity={identity}
        identityHint={activeAccount?.name || null}
        addOutput={addOutput}
        setLastResolvedUri={setLastResolvedUri}
        lastResolvedUri={lastResolvedUri}
        outputs={editorOutputs}
        mode="file"
      />
    );
  }

  return (
    <Surface
      rig={rig}
      identity={identity}
      identityHint={activeAccount?.name || null}
      addOutput={addOutput}
      setLastResolvedUri={setLastResolvedUri}
      lastResolvedUri={lastResolvedUri}
      outputs={editorOutputs}
      mode="text"
    />
  );
}

interface SurfaceProps {
  rig: BackendClient | null;
  identity: ReturnType<typeof useAppStore.getState>["identity"];
  identityHint: string | null;
  addOutput: ReturnType<typeof useAppStore.getState>["addEditorOutput"];
  setLastResolvedUri: ReturnType<
    typeof useAppStore.getState
  >["setEditorLastResolvedUri"];
  lastResolvedUri: string | null;
  outputs: ReturnType<typeof useAppStore.getState>["editorOutputs"];
  mode: "text" | "file";
}

function Surface(props: SurfaceProps) {
  const { rig, identity, identityHint, mode } = props;
  const [uriTemplate, setUriTemplate] = useState("");
  const [textPayload, setTextPayload] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [encryptToPubkey, setEncryptToPubkey] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tokens = findTokens(uriTemplate);
  const knownInTemplate = tokens.filter((t) => knownTokens().includes(t));
  const needsIdentity = knownInTemplate.includes("account") ||
    knownInTemplate.includes("signature");
  const identityMissing = needsIdentity && !identity;

  const canSubmit = !busy &&
    !!rig &&
    uriTemplate.trim().length > 0 &&
    !identityMissing &&
    (mode === "text" ? textPayload.trim().length > 0 : file !== null);

  const handlePreview = async () => {
    setError(null);
    if (!uriTemplate.trim()) return;
    try {
      // Preview uses placeholder content (real hash/signature only computed at submit)
      const placeholderContent = mode === "text"
        ? safeParse(textPayload)
        : { _preview: file?.name ?? "" };
      const resolved = await resolveUriTemplate(uriTemplate, {
        identity,
        content: placeholderContent,
      });
      setPreviewUri(resolved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSubmit = async () => {
    if (!rig) return;
    setError(null);
    setBusy(true);
    try {
      const recipient = encryptToPubkey.trim() || undefined;

      if (mode === "text") {
        const parsed = safeParse(textPayload);
        const result = await writePlain({
          client: rig,
          identity,
          uriTemplate,
          payload: parsed,
          encryptToPublicKey: recipient,
        });
        props.setLastResolvedUri(result.resolvedUri);
        props.addOutput({
          uri: result.resolvedUri,
          data: result.content,
          accepted: result.accepted,
          error: result.error,
        });
        if (!result.accepted) setError(result.error || "Write rejected");
      } else if (file) {
        const result = await writeFile({
          client: rig,
          identity,
          uriTemplate,
          file,
          encryptToPublicKey: recipient,
        });
        props.setLastResolvedUri(result.resolvedUri);
        props.addOutput({
          uri: result.resolvedUri,
          data: { fileName: result.fileName, size: result.fileSize },
          accepted: result.accepted,
          error: result.error,
        });
        if (!result.accepted) setError(result.error || "Write rejected");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          {mode === "text"
            ? <FileText className="h-5 w-5 text-muted-foreground" />
            : <Upload className="h-5 w-5 text-muted-foreground" />}
          <div>
            <h1 className="text-lg font-semibold">
              Editor — {mode === "text" ? "Text" : "File"}
            </h1>
            <p className="text-xs text-muted-foreground">
              URI template + payload, sent through the active rig.
              Protocol-specific signing is provided by plugins.
            </p>
          </div>
        </div>
        <IdentityBanner identity={identity} hint={identityHint} />
      </header>

      <div className="flex-1 overflow-auto custom-scrollbar p-6 space-y-6 max-w-4xl">
        <Field
          label="URI template"
          hint={`Tokens: ${knownTokens().map((t) => `:${t}`).join(", ")}`}
        >
          <input
            type="text"
            value={uriTemplate}
            onChange={(e) => setUriTemplate(e.target.value)}
            placeholder={`mutable://accounts/${TEMPLATE_PLACEHOLDER}/note`}
            className="w-full font-mono text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {tokens.length > 0 && (
            <TokenChips tokens={tokens} known={knownTokens()} />
          )}
        </Field>

        {mode === "text" && (
          <Field
            label="Payload (JSON or plain text)"
            hint="JSON-parsed when valid; sent as-is otherwise."
          >
            <textarea
              value={textPayload}
              onChange={(e) => setTextPayload(e.target.value)}
              rows={10}
              placeholder='{"hello": "world"}'
              className="w-full font-mono text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>
        )}

        {mode === "file" && (
          <Field label="File" hint="Sent as { type, name, size, data }.">
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block text-sm"
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-2">
                {file.name} · {formatBytes(file.size)} · {file.type || "—"}
              </p>
            )}
          </Field>
        )}

        <Field
          label="Encrypt to recipient pubkey (optional)"
          hint="X25519 public key hex. Leave empty for plaintext."
        >
          <input
            type="text"
            value={encryptToPubkey}
            onChange={(e) => setEncryptToPubkey(e.target.value)}
            placeholder="04ab…"
            className="w-full font-mono text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {encryptToPubkey.trim() && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <Lock className="h-3 w-3" /> content will be encrypted before send
            </p>
          )}
        </Field>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={!uriTemplate.trim() || identityMissing}
            className="px-3 py-2 text-sm border border-border rounded-md hover:bg-foreground/5 disabled:opacity-40"
          >
            Preview URI
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2",
              canSubmit
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send"}
          </button>
        </div>

        {previewUri && (
          <Notice tone="info" icon={<Info className="h-4 w-4" />}>
            <span className="font-mono text-xs break-all">{previewUri}</span>
          </Notice>
        )}

        {error && (
          <Notice tone="error" icon={<AlertCircle className="h-4 w-4" />}>
            {error}
          </Notice>
        )}

        {props.lastResolvedUri && !error && (
          <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" />}>
            Last sent: <span className="font-mono text-xs break-all">{props.lastResolvedUri}</span>
          </Notice>
        )}

        {props.outputs.length > 0 && (
          <section className="pt-4 border-t border-border/40">
            <h2 className="text-sm font-semibold mb-2">Recent</h2>
            <ul className="space-y-2">
              {props.outputs.slice(0, 10).map((o) => (
                <li
                  key={o.id}
                  className="text-xs font-mono p-2 rounded bg-foreground/5 break-all"
                >
                  <span
                    className={cn(
                      "inline-block w-2 h-2 rounded-full mr-2 align-middle",
                      o.accepted ? "bg-green-500" : "bg-red-500",
                    )}
                  />
                  {o.uri}
                  {o.error && (
                    <span className="text-red-500 ml-2">— {o.error}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TokenChips({ tokens, known }: { tokens: string[]; known: string[] }) {
  const seen = new Set<string>();
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {tokens.map((t, i) => {
        const isKnown = known.includes(t);
        const key = `${t}-${i}`;
        if (seen.has(t)) return null;
        seen.add(t);
        return (
          <span
            key={key}
            className={cn(
              "px-2 py-0.5 rounded text-xs font-mono",
              isKnown
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}
            title={isKnown ? "Built-in or registered token" : "Unknown token (passed through unchanged)"}
          >
            :{t}
          </span>
        );
      })}
    </div>
  );
}

function IdentityBanner({
  identity,
  hint,
}: {
  identity: ReturnType<typeof useAppStore.getState>["identity"];
  hint: string | null;
}) {
  if (!identity) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        No active identity — `:account` and `:signature` will fail. Pick an
        account from the header.
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-muted-foreground font-mono break-all">
      {hint && <span className="text-foreground mr-2">{hint}</span>}
      {identity.pubkey.slice(0, 16)}…{identity.pubkey.slice(-8)}
    </p>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "info" | "success" | "error";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const colorClass = tone === "success"
    ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
    : tone === "error"
    ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
    : "border-border bg-foreground/5";
  return (
    <div
      className={cn("flex items-start gap-2 px-3 py-2 rounded-md border", colorClass)}
    >
      {icon}
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );
}

function safeParse(input: string): unknown {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

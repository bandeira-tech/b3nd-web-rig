import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  KeyRound,
  Plus,
  Trash2,
  UploadCloud,
  UserCircle,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { generateAccountIdentity } from "../../services/editor/editorService";
import type { ManagedAccount } from "../../types";
import { cn, generateId } from "../../utils";
import { SectionCard } from "../common/SectionCard";
import type { ExportedIdentity } from "@jsr/bandeira-tech__b3nd-core/identity";

const PRIMARY =
  "inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SECONDARY =
  "inline-flex items-center gap-2 rounded border border-border bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const EMOJI_POOL = [
  "🦊", "🦁", "🐼", "🐙", "🦄", "🐢", "🦋", "🐬", "🦉", "🦜",
];

function randomEmoji(): string {
  return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
}

export function AccountsView() {
  const accounts = useAppStore((s) => s.accounts);
  const activeAccountId = useAppStore((s) => s.activeAccountId);
  const addAccount = useAppStore((s) => s.addAccount);
  const removeAccount = useAppStore((s) => s.removeAccount);
  const setActiveAccount = useAppStore((s) => s.setActiveAccount);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || null,
    [accounts, activeAccountId],
  );

  return (
    <div className="space-y-4 p-4 max-w-3xl mx-auto">
      <SectionCard
        title="Active account"
        icon={<UserCircle className="h-4 w-4" />}
      >
        {activeAccount
          ? <AccountSummary account={activeAccount} active />
          : (
            <p className="text-sm text-muted-foreground">
              No active account. Generate or import below.
            </p>
          )}
      </SectionCard>

      <SectionCard title="Manage" icon={<KeyRound className="h-4 w-4" />}>
        <div className="flex flex-wrap gap-2">
          <GenerateButton onCreate={addAccount} />
          <ImportButton onImport={addAccount} />
        </div>
      </SectionCard>

      <SectionCard
        title={`Accounts (${accounts.length})`}
        icon={<UserCircle className="h-4 w-4" />}
      >
        {accounts.length === 0
          ? (
            <p className="text-sm text-muted-foreground">
              No accounts yet.
            </p>
          )
          : (
            <ul className="space-y-2">
              {accounts.map((acct) => (
                <li key={acct.id}>
                  <AccountRow
                    account={acct}
                    active={acct.id === activeAccountId}
                    onActivate={() => setActiveAccount(acct.id)}
                    onRemove={() => removeAccount(acct.id)}
                  />
                </li>
              ))}
            </ul>
          )}
      </SectionCard>
    </div>
  );
}

function GenerateButton({
  onCreate,
}: {
  onCreate: (a: ManagedAccount) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={PRIMARY}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { exported, pubkey, encryptionPubkey } =
            await generateAccountIdentity();
          onCreate({
            id: generateId(),
            name: `Account ${pubkey.slice(0, 6)}`,
            createdAt: Date.now(),
            emoji: randomEmoji(),
            pubkey,
            encryptionPubkey,
            exportedIdentity: exported,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Plus className="h-4 w-4" />
      {busy ? "Generating…" : "Generate new"}
    </button>
  );
}

function ImportButton({
  onImport,
}: {
  onImport: (a: ManagedAccount) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    try {
      const parsed = JSON.parse(text) as ExportedIdentity;
      if (!parsed.signingPublicKeyHex || !parsed.encryptionPublicKeyHex) {
        throw new Error("Missing required keys (signingPublicKeyHex, encryptionPublicKeyHex)");
      }
      onImport({
        id: generateId(),
        name: `Imported ${parsed.signingPublicKeyHex.slice(0, 6)}`,
        createdAt: Date.now(),
        emoji: randomEmoji(),
        pubkey: parsed.signingPublicKeyHex,
        encryptionPubkey: parsed.encryptionPublicKeyHex,
        exportedIdentity: parsed,
      });
      setText("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!open) {
    return (
      <button className={SECONDARY} onClick={() => setOpen(true)}>
        <UploadCloud className="h-4 w-4" /> Import JSON
      </button>
    );
  }
  return (
    <div className="w-full space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder='{"signingPublicKeyHex":"…","signingPrivateKeyHex":"…","encryptionPublicKeyHex":"…","encryptionPrivateKeyHex":"…"}'
        className="w-full font-mono text-xs bg-background border border-border rounded p-2"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button className={PRIMARY} onClick={submit}>Import</button>
        <button
          className={SECONDARY}
          onClick={() => {
            setOpen(false);
            setText("");
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  active,
  onActivate,
  onRemove,
}: {
  account: ManagedAccount;
  active: boolean;
  onActivate: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded border p-3",
        active ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <span className="text-2xl">{account.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{account.name}</p>
          {active && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              active
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {account.pubkey}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <CopyButton value={account.pubkey} title="Copy pubkey" />
        <ExportButton account={account} />
        {!active && (
          <button
            className="p-2 text-muted-foreground hover:text-foreground"
            title="Set active"
            onClick={onActivate}
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button
          className="p-2 text-muted-foreground hover:text-red-500"
          title="Delete account"
          onClick={() => {
            if (confirm(`Delete ${account.name}? This is irreversible.`)) {
              onRemove();
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AccountSummary({
  account,
  active,
}: {
  account: ManagedAccount;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl">{account.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{account.name}</p>
        <p className="text-xs text-muted-foreground font-mono break-all">
          {account.pubkey}
        </p>
        {active && (
          <p className="text-xs text-muted-foreground mt-1">
            enc: <span className="font-mono">{account.encryptionPubkey.slice(0, 24)}…</span>
          </p>
        )}
      </div>
    </div>
  );
}

function CopyButton({ value, title }: { value: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="p-2 text-muted-foreground hover:text-foreground"
      title={title}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function ExportButton({ account }: { account: ManagedAccount }) {
  return (
    <button
      className="p-2 text-muted-foreground hover:text-foreground"
      title="Export identity JSON"
      onClick={() => {
        const blob = new Blob(
          [JSON.stringify(account.exportedIdentity, null, 2)],
          { type: "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${account.name.replace(/\s+/g, "-")}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download className="h-4 w-4" />
    </button>
  );
}

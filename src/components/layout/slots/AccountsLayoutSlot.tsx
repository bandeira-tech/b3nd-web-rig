import { AccountsView } from "../../accounts/AccountsView";

export function AccountsLayoutSlot() {
  return (
    <div className="h-full flex overflow-hidden bg-background text-foreground">
      <div className="flex-1 overflow-auto custom-scrollbar">
        <AccountsView />
      </div>
    </div>
  );
}

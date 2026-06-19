import type { ComponentType } from "react";
import { useAppStore } from "../../stores/appStore";
import { ExplorerLeftSlot } from "./slots/ExplorerLeftSlot";
import { ExplorerLayoutSlot } from "./slots/ExplorerLayoutSlot";
import { EditorLeftSlot } from "./slots/EditorLeftSlot";
import { EditorLayoutSlot } from "./slots/EditorLayoutSlot";
import { NodesLeftSlot } from "../nodes/NodesLeftSlot";
import { NodesLayoutSlot } from "../nodes/NodesLayoutSlot";
import { SettingsLayoutSlot } from "./slots/SettingsLayoutSlot";
import { AccountsLayoutSlot } from "./slots/AccountsLayoutSlot";
import { SimpleLeftSlot } from "./slots/SimpleLeftSlot";
import { AppsLayoutSlot } from "../apps/AppsLayoutSlot";
import type { AppMode } from "../../types";

type LayoutSlotKey =
  | "settings"
  | "accounts"
  | "editor"
  | "explorer"
  | "nodes"
  | "apps";

type LayoutSlot = {
  Left: ComponentType;
  Main: ComponentType;
  rightPanelToggleVisible: (params: { mode: AppMode }) => boolean;
};

const layoutSlots: Record<LayoutSlotKey, LayoutSlot> = {
  settings: {
    Left: () => <SimpleLeftSlot title="Settings" />,
    Main: SettingsLayoutSlot,
    rightPanelToggleVisible: () => true,
  },
  accounts: {
    Left: () => <SimpleLeftSlot title="Accounts" />,
    Main: AccountsLayoutSlot,
    rightPanelToggleVisible: () => true,
  },
  editor: {
    Left: EditorLeftSlot,
    Main: EditorLayoutSlot,
    rightPanelToggleVisible: () => true,
  },
  explorer: {
    Left: ExplorerLeftSlot,
    Main: ExplorerLayoutSlot,
    rightPanelToggleVisible: ({ mode }) => mode === "filesystem",
  },
  nodes: {
    Left: NodesLeftSlot,
    Main: NodesLayoutSlot,
    rightPanelToggleVisible: () => true,
  },
  apps: {
    Left: () => <SimpleLeftSlot title="Apps" />,
    Main: AppsLayoutSlot,
    rightPanelToggleVisible: () => false,
  },
};

export function useLayoutSlots() {
  const mainView = useAppStore((state) => state.mainView);
  const activeApp = useAppStore((state) => state.activeApp);
  const mode = useAppStore((state) => state.mode);

  const slotKey: LayoutSlotKey = (() => {
    if (mainView === "settings") return "settings";
    if (mainView === "accounts") return "accounts";
    if (activeApp === "nodes") return "nodes";
    if (activeApp === "editor") return "editor";
    if (activeApp === "explorer") return "explorer";
    if (activeApp === "apps") return "apps";
    throw new Error("Unsupported layout slot configuration");
  })();

  const slot = layoutSlots[slotKey];
  if (!slot) {
    throw new Error(`Missing layout slot for key ${slotKey}`);
  }

  return {
    LeftSlot: slot.Left,
    MainSlot: slot.Main,
    rightPanelToggleVisible: slot.rightPanelToggleVisible({ mode }),
  };
}

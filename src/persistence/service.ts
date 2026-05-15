import { loadGlobalSetting, saveGlobalSetting } from "../config/globalSettings.ts";
import { HistoryStore, type HistoryKind } from "../history/store.ts";

type HistoryStoreLike = Readonly<{
  load(kind: HistoryKind): Promise<string[]>;
  loadSetting(key: string): Promise<string>;
  saveSetting(key: string, value: string): Promise<void>;
  record(kind: HistoryKind, value: string): Promise<string[]>;
  remove(kind: HistoryKind, value: string): Promise<string[]>;
}>;

export type PersistenceService = ReturnType<typeof createPersistenceService>;

export function createPersistenceService(args: Readonly<{
  createHistoryStore?(workspaceRoot: string): HistoryStoreLike;
  loadGlobalSetting?(key: string): Promise<string>;
  saveGlobalSetting?(key: string, value: string): Promise<void>;
}> = {}) {
  const createHistoryStore = args.createHistoryStore ?? ((workspaceRoot: string) => new HistoryStore(workspaceRoot));
  const loadGlobal = args.loadGlobalSetting ?? loadGlobalSetting;
  const saveGlobal = args.saveGlobalSetting ?? saveGlobalSetting;

  return {
    async loadLayoutPreference(): Promise<string> {
      return await loadGlobal("layout");
    },
    async saveLayoutPreference(layout: string): Promise<void> {
      await saveGlobal("layout", layout);
    },
    async loadCommandHistory(workspaceRoot: string): Promise<string[]> {
      return await createHistoryStore(workspaceRoot).load("command-history");
    },
    async recordCommandHistory(workspaceRoot: string, commandText: string): Promise<string[]> {
      return await createHistoryStore(workspaceRoot).record("command-history", commandText);
    },
    async removeCommandHistory(workspaceRoot: string, commandText: string): Promise<string[]> {
      return await createHistoryStore(workspaceRoot).remove("command-history", commandText);
    },
    async loadShellHistory(workspaceRoot: string): Promise<string[]> {
      return await createHistoryStore(workspaceRoot).load("shell-history");
    },
    async recordShellHistory(workspaceRoot: string, commandText: string): Promise<string[]> {
      return await createHistoryStore(workspaceRoot).record("shell-history", commandText);
    },
    async removeShellHistory(workspaceRoot: string, commandText: string): Promise<string[]> {
      return await createHistoryStore(workspaceRoot).remove("shell-history", commandText);
    },
    async loadRevsetHistory(workspaceRoot: string): Promise<string[]> {
      return await createHistoryStore(workspaceRoot).load("revset-history");
    },
    async recordRevsetHistory(workspaceRoot: string, query: string): Promise<string[]> {
      return await createHistoryStore(workspaceRoot).record("revset-history", query);
    },
    async removeRevsetHistory(workspaceRoot: string, query: string): Promise<string[]> {
      return await createHistoryStore(workspaceRoot).remove("revset-history", query);
    },
    async loadActiveRevset(workspaceRoot: string): Promise<string> {
      return await createHistoryStore(workspaceRoot).loadSetting("active-revset");
    },
    async saveActiveRevset(workspaceRoot: string, query: string): Promise<void> {
      await createHistoryStore(workspaceRoot).saveSetting("active-revset", query);
    },
  };
}
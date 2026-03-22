import { createRoot } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import type {
  AppState,
  ChangedFile,
  CommandDraftConfig,
  RepositoryData,
  StatusLevel,
} from "../domain/types.ts";
import {
  applyRepositoryData,
  cancelCommandState,
  clearStatusMessage,
  closeFocusedRevision,
  dismissOldestError,
  startCommandDraft,
  createInitialState,
  focusCommandBar,
  moveFocus,
  openFocusedRevision,
  pushEvent,
  setCommandBarText,
  setError,
  setLoading,
  setRevisionFiles,
  toggleRebaseDescendants,
  toggleRevisionSelection,
} from "./store.ts";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(repoPath: string) {
  let state!: AppState;
  let setState!: ReturnType<typeof createStore<AppState>>[1];

  const dispose = createRoot((disposeStore) => {
    const [store, setStore] = createStore<AppState>(createInitialState(repoPath));
    state = store;
    setState = setStore;
    return disposeStore;
  });

  function replaceState(nextState: AppState) {
    setState(nextState as AppState);
  }

  function mutate(recipe: (currentState: AppState) => AppState) {
    replaceState(recipe(snapshot()));
  }

  function snapshot(): AppState {
    return structuredClone(unwrap(state));
  }

  return {
    state,
    snapshot,
    dispose,
    actions: {
      setLoading(loading: boolean) {
        mutate((currentState) => setLoading(currentState, loading));
      },
      setError(message: string | null) {
        mutate((currentState) => setError(currentState, message));
      },
      pushEvent(text: string, level: StatusLevel) {
        mutate((currentState) => pushEvent(currentState, text, level));
      },
      applyRepositoryData(repositoryData: RepositoryData) {
        mutate((currentState) => applyRepositoryData(currentState, repositoryData));
      },
      setRevisionFiles(revisionId: string, files: readonly ChangedFile[]) {
        mutate((currentState) => setRevisionFiles(currentState, revisionId, files));
      },
      moveFocus(delta: number) {
        mutate((currentState) => moveFocus(currentState, delta));
      },
      openFocusedRevision() {
        mutate((currentState) => openFocusedRevision(currentState));
      },
      closeFocusedRevision() {
        mutate((currentState) => closeFocusedRevision(currentState));
      },
      focusCommandBar() {
        mutate((currentState) => focusCommandBar(currentState));
      },
      setCommandBarText(text: string) {
        mutate((currentState) => setCommandBarText(currentState, text));
      },
      cancelCommand() {
        mutate((currentState) => cancelCommandState(currentState));
      },
      clearStatusMessage() {
        mutate((currentState) => clearStatusMessage(currentState));
      },
      dismissOldestError() {
        mutate((currentState) => dismissOldestError(currentState));
      },
      startCommandDraft(config: CommandDraftConfig, options?: { descendantRevisionIds?: readonly string[] }) {
        mutate((currentState) => startCommandDraft(currentState, config, options));
      },
      toggleRevisionSelection() {
        mutate((currentState) => toggleRevisionSelection(currentState));
      },
      toggleRebaseDescendants(descendantIds: readonly string[]) {
        mutate((currentState) => toggleRebaseDescendants(currentState, descendantIds));
      },
    },
  };
}

import { createRoot } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import type {
  AppState,
  ChangedFile,
  CommandDraftConfig,
  RepositoryData,
  StatusLevel,
} from "../domain/types.ts";
import {
  applyRepositoryData,
  cancelCommandDraft,
  cancelCommandState,
  clearRevisionSelection,
  clearStatusMessage,
  closeFocusedRevision,
  focusWorkingCopy,
  openRevsetInput,
  closeRevsetInput,
  setRevsetQuery,
  dismissStatusMessage,
  startCommandDraft,
  toggleFileSelection,
  toggleShortFlags,
  toggleCondensedLayout,
  createInitialState,
  focusCommandBar,
  moveFocus,
  openFocusedRevision,
  pushEvent,
  setCommandBarText,
  setLoading,
  setRevisionFiles,
  toggleRebaseDescendants,
  toggleRevisionSelection,
} from "./store.ts";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(
  repoPath: string,
  options?: { useShortFlags?: boolean; condensedLayout?: boolean },
) {
  let state!: AppState;
  let setState!: ReturnType<typeof createStore<AppState>>[1];

  const dispose = createRoot((disposeStore) => {
    const [store, setStore] = createStore<AppState>(createInitialState(repoPath, options));
    state = store;
    setState = setStore;
    return disposeStore;
  });

  function replaceState(nextState: AppState) {
    setState(reconcile(nextState, { key: "changeId" }));
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
      dismissStatusMessage() {
        mutate((currentState) => dismissStatusMessage(currentState));
      },
      startCommandDraft(config: CommandDraftConfig, options?: { descendantRevisionIds?: readonly string[] }) {
        mutate((currentState) => startCommandDraft(currentState, config, options));
      },
      toggleRevisionSelection() {
        mutate((currentState) => toggleRevisionSelection(currentState));
      },
      toggleFileSelection() {
        mutate((currentState) => toggleFileSelection(currentState));
      },
      cancelCommandDraft() {
        mutate((currentState) => cancelCommandDraft(currentState));
      },
      clearRevisionSelection() {
        mutate((currentState) => clearRevisionSelection(currentState));
      },
      toggleShortFlags() {
        mutate((currentState) => toggleShortFlags(currentState));
      },
      toggleCondensedLayout() {
        mutate((currentState) => toggleCondensedLayout(currentState));
      },
      toggleRebaseDescendants(descendantIds: readonly string[]) {
        mutate((currentState) => toggleRebaseDescendants(currentState, descendantIds));
      },
      focusWorkingCopy() {
        mutate((currentState) => focusWorkingCopy(currentState));
      },
      openRevsetInput() {
        mutate((currentState) => openRevsetInput(currentState));
      },
      closeRevsetInput() {
        mutate((currentState) => closeRevsetInput(currentState));
      },
      setRevsetQuery(query: string) {
        mutate((currentState) => setRevsetQuery(currentState, query));
      },
    },
  };
}

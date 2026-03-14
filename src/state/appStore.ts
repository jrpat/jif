import { createRoot, createStore, flush, snapshot } from "@solidjs/signals";
import type {
  AppState,
  ChangedFile,
  RepositoryData,
  StatusLevel,
} from "../domain/types.ts";
import {
  applyRepositoryData,
  backspaceCommandText,
  cancelCommandState,
  createInitialState,
  deleteCommandText,
  focusCommandBar,
  insertCommandText,
  moveCommandCursor,
  moveFocus,
  openFocusedRevision,
  pushEvent,
  setError,
  setLoading,
  setRevisionFiles,
  startRebaseCommand,
  toggleRebaseDescendants,
} from "./store.ts";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(repoPath: string, onCommit: () => void) {
  let state!: AppState;
  let setState!: (recipe: (draft: AppState) => void) => void;

  const dispose = createRoot((disposeStore) => {
    const [store, setStore] = createStore<AppState>(createInitialState(repoPath));
    state = store;
    setState = setStore;
    return disposeStore;
  });

  function replaceState(nextState: AppState) {
    setState((draft) => {
      Object.assign(draft, nextState);
    });
    flush();
    onCommit();
  }

  function mutate(recipe: (currentState: AppState) => AppState) {
    replaceState(recipe(snapshot(state) as AppState));
  }

  return {
    state,
    snapshot: () => snapshot(state) as AppState,
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
        mutate((currentState) => ({
          ...currentState,
          expandedRevisionId:
            currentState.revisions[currentState.focusedRevisionIndex]?.changeId ===
            currentState.expandedRevisionId
              ? null
              : currentState.expandedRevisionId,
          focusedFileIndex: 0,
        }));
      },
      focusCommandBar() {
        mutate((currentState) => focusCommandBar(currentState));
      },
      cancelCommand() {
        mutate((currentState) => cancelCommandState(currentState));
      },
      insertCommandText(text: string) {
        mutate((currentState) => insertCommandText(currentState, text));
      },
      moveCommandCursor(delta: number) {
        mutate((currentState) => moveCommandCursor(currentState, delta));
      },
      backspaceCommandText() {
        mutate((currentState) => backspaceCommandText(currentState));
      },
      deleteCommandText() {
        mutate((currentState) => deleteCommandText(currentState));
      },
      startRebaseCommand(descendantIds: readonly string[]) {
        mutate((currentState) => startRebaseCommand(currentState, descendantIds));
      },
      toggleRebaseDescendants(descendantIds: readonly string[]) {
        mutate((currentState) => toggleRebaseDescendants(currentState, descendantIds));
      },
    },
  };
}

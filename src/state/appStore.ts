import { createRoot } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import type {
  AppLayout,
  AppState,
  ChangedFile,
  CommandDraftConfig,
  RepositoryData,
  RevisionSummary,
  StatusLevel,
} from "../domain/types.ts";
import {
  applyRepositoryData,
  cancelOrBlurState,
  cancelCommandDraft,
  cancelCommandState,
  clearRevisionSelection,
  cycleLayout,
  clearStatusMessage,
  closeFocusedRevision,
  focusWorkingCopy,
  openRevsetInput,
  closeRevsetInput,
  closeSearch,
  closeShortcutPanel,
  setRevsetQuery,
  setSearchText,
  openSearch,
  finalizeSearch,
  nextSearchMatch,
  prevSearchMatch,
  dismissStatusMessage,
  expandElidedRevision,
  logEvent,
  pushStatusMessage,
  startCommandDraft,
  toggleFileSelection,
  toggleShortFlags,
  toggleShortcutPanel,
  createInitialState,
  focusCommandBar,
  moveFocus,
  moveFocusToParent,
  openShortcutPanel,
  openFocusedRevision,
  pushEvent,
  setCommandBarText,
  setLoading,
  setRevisionFiles,
  toggleRebaseDescendants,
  toggleRevisionSelection,
  updateStatusMessage,
} from "./store.ts";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(
  repoPath: string,
  options?: { useShortFlags?: boolean; layout?: AppLayout },
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
    setState(reconcile(nextState, { key: "rowId" }));
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
      pushStatusMessage(id: string, text: string, level: StatusLevel) {
        mutate((currentState) => pushStatusMessage(currentState, id, text, level));
      },
      updateStatusMessage(id: string, text: string, level: StatusLevel) {
        mutate((currentState) => updateStatusMessage(currentState, id, text, level));
      },
      logEvent(text: string, level: StatusLevel) {
        mutate((currentState) => logEvent(currentState, text, level));
      },
      applyRepositoryData(repositoryData: RepositoryData) {
        mutate((currentState) => applyRepositoryData(currentState, repositoryData));
      },
      setRevisionFiles(rowId: string, files: readonly ChangedFile[]) {
        mutate((currentState) => setRevisionFiles(currentState, rowId, files));
      },
      moveFocus(delta: number) {
        mutate((currentState) => moveFocus(currentState, delta));
      },
      moveFocusToParent() {
        mutate((currentState) => moveFocusToParent(currentState));
      },
      openFocusedRevision() {
        mutate((currentState) => openFocusedRevision(currentState));
      },
      expandElidedRevision(elidedIndex: number, replacements: readonly RevisionSummary[]) {
        mutate((currentState) => expandElidedRevision(currentState, elidedIndex, replacements));
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
      cancelOrBlur() {
        mutate((currentState) => cancelOrBlurState(currentState));
      },
      clearStatusMessage() {
        mutate((currentState) => clearStatusMessage(currentState));
      },
      dismissStatusMessage(id?: string) {
        mutate((currentState) => dismissStatusMessage(currentState, id));
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
      cycleLayout() {
        mutate((currentState) => cycleLayout(currentState));
      },
      openShortcutPanel() {
        mutate((currentState) => openShortcutPanel(currentState));
      },
      closeShortcutPanel() {
        mutate((currentState) => closeShortcutPanel(currentState));
      },
      toggleShortcutPanel() {
        mutate((currentState) => toggleShortcutPanel(currentState));
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
      openSearch() {
        mutate((currentState) => openSearch(currentState));
      },
      setSearchText(query: string) {
        mutate((currentState) => setSearchText(currentState, query));
      },
      finalizeSearch() {
        mutate((currentState) => finalizeSearch(currentState));
      },
      closeSearch() {
        mutate((currentState) => closeSearch(currentState));
      },
      nextSearchMatch() {
        mutate((currentState) => nextSearchMatch(currentState));
      },
      prevSearchMatch() {
        mutate((currentState) => prevSearchMatch(currentState));
      },
    },
  };
}

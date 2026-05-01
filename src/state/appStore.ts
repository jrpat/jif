import { createRoot } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import type {
  AppLayout,
  AppState,
  ChangedFile,
  CommandDraftConfig,
  FailedCommand,
  InlineConfirmation,
  RepositoryData,
  RevisionSummary,
  StatusLevel,
} from "../domain/types.ts";
import {
  applyRepositoryData,
  cancelOrBlurState,
  closeInlineConfirmation,
  cancelCommandDraft,
  cancelCommandState,
  clearLastFailedCommand,
  clearRevisionSelection,
  cycleLayout,
  clearStatusMessage,
  closeFocusedRevision,
  focusLogBottom,
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
  openInlineConfirmation,
  pushStatusMessage,
  selectNextInlineConfirmationOption,
  selectPreviousInlineConfirmationOption,
  startCommandDraft,
  toggleFileSelection,
  toggleShortFlags,
  toggleShortcutPanel,
  createInitialState,
  focusCommandBar,
  moveFocus,
  moveFocusToChild,
  moveFocusToParent,
  openShortcutPanel,
  openFocusedRevision,
  pushEvent,
  setLastFailedCommand,
  setCommandBarText,
  setLoading,
  setRevisionFiles,
  touchStatusMessage,
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
      touchStatusMessage(id: string) {
        mutate((currentState) => touchStatusMessage(currentState, id));
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
      moveFocusToChild() {
        mutate((currentState) => moveFocusToChild(currentState));
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
      setLastFailedCommand(failedCommand: FailedCommand) {
        mutate((currentState) => setLastFailedCommand(currentState, failedCommand));
      },
      clearLastFailedCommand() {
        mutate((currentState) => clearLastFailedCommand(currentState));
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
      openInlineConfirmation(confirmation: InlineConfirmation) {
        mutate((currentState) => openInlineConfirmation(currentState, confirmation));
      },
      closeInlineConfirmation() {
        mutate((currentState) => closeInlineConfirmation(currentState));
      },
      selectPreviousInlineConfirmationOption() {
        mutate((currentState) => selectPreviousInlineConfirmationOption(currentState));
      },
      selectNextInlineConfirmationOption() {
        mutate((currentState) => selectNextInlineConfirmationOption(currentState));
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
      focusLogBottom() {
        mutate((currentState) => focusLogBottom(currentState));
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

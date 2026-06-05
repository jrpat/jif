import { createRoot } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import type {
  AppLayout,
  AppState,
  BookmarkSuggestion,
  ChangedFile,
  CommandDraftConfig,
  FailedCommand,
  InlineConfirmation,
  RebaseSourceKind,
  RebaseTargetKind,
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
  closeOperationLog,
  closeEvolog,
  closeDiffViewer,
  closeNotifications,
  enterBookmarkLeader,
  exitBookmarkLeader,
  enterExtrasMode,
  exitExtrasMode,
  startBookmarkPrompt,
  collapseFocusedNotification,
  expandFocusedNotification,
  focusLogBottom,
  focusNotificationAt,
  focusOperationLogEntryAt,
  focusEvologEntryAt,
  focusRevisionAt,
  focusWorkingCopy,
  openNotifications,
  openOperationLog,
  openEvolog,
  openDiffViewer,
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
  toggleSearchIdOnly,
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
  focusShellCommandBar,
  moveFocus,
  moveFocusToChild,
  moveFocusToNextDivergentSibling,
  moveFocusToParent,
  moveFocusToWorkspace,
  openShortcutPanel,
  openFocusedRevision,
  pushEvent,
  setLastFailedCommand,
  setCommandBarText,
  setLoading,
  setOperationLogEntries,
  setOperationLogLoading,
  setEvologEntries,
  setEvologLoading,
  setRevisionFiles,
  touchStatusMessage,
  setRebaseSourceKind,
  setRebaseTargetKind,
  toggleInterdiffSwap,
  toggleRebaseSkipEmptied,
  toggleRevisionSelection,
  toggleSquashAnchor,
  updateStatusMessage,
} from "./store.ts";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(
  repoPath: string,
  options?: { useShortFlags?: boolean; layout?: AppLayout; notificationHistoryLimit?: number },
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
      setOperationLogLoading(loading: boolean) {
        mutate((currentState) => setOperationLogLoading(currentState, loading));
      },
      setEvologLoading(loading: boolean) {
        mutate((currentState) => setEvologLoading(currentState, loading));
      },
      pushEvent(text: string, level: StatusLevel) {
        mutate((currentState) => pushEvent(currentState, text, level));
      },
      reportError(error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        mutate((currentState) => pushEvent(currentState, message, "error"));
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
      setOperationLogEntries(operationLogEntries: AppState["operationLogEntries"]) {
        mutate((currentState) => setOperationLogEntries(currentState, operationLogEntries));
      },
      setEvologEntries(evologEntries: AppState["evologEntries"]) {
        mutate((currentState) => setEvologEntries(currentState, evologEntries));
      },
      moveFocus(delta: number) {
        mutate((currentState) => moveFocus(currentState, delta));
      },
      focusRevisionAt(index: number) {
        mutate((currentState) => focusRevisionAt(currentState, index));
      },
      focusOperationLogEntryAt(index: number) {
        mutate((currentState) => focusOperationLogEntryAt(currentState, index));
      },
      focusEvologEntryAt(index: number) {
        mutate((currentState) => focusEvologEntryAt(currentState, index));
      },
      focusNotificationAt(index: number) {
        mutate((currentState) => focusNotificationAt(currentState, index));
      },
      moveFocusToParent() {
        mutate((currentState) => moveFocusToParent(currentState));
      },
      moveFocusToChild() {
        mutate((currentState) => moveFocusToChild(currentState));
      },
      moveFocusToNextDivergentSibling() {
        mutate((currentState) => moveFocusToNextDivergentSibling(currentState));
      },
      moveFocusToWorkspace(direction: 1 | -1) {
        mutate((currentState) => moveFocusToWorkspace(currentState, direction));
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
      openOperationLog() {
        mutate((currentState) => openOperationLog(currentState));
      },
      closeOperationLog() {
        mutate((currentState) => closeOperationLog(currentState));
      },
      openEvolog(label: string) {
        mutate((currentState) => openEvolog(currentState, label));
      },
      closeEvolog() {
        mutate((currentState) => closeEvolog(currentState));
      },
      openNotifications() {
        mutate((currentState) => openNotifications(currentState));
      },
      closeNotifications() {
        mutate((currentState) => closeNotifications(currentState));
      },
      expandFocusedNotification() {
        mutate((currentState) => expandFocusedNotification(currentState));
      },
      collapseFocusedNotification() {
        mutate((currentState) => collapseFocusedNotification(currentState));
      },
      openDiffViewer(content: string) {
        mutate((currentState) => openDiffViewer(currentState, content));
      },
      closeDiffViewer() {
        mutate((currentState) => closeDiffViewer(currentState));
      },
      focusCommandBar() {
        mutate((currentState) => focusCommandBar(currentState));
      },
      focusShellCommandBar() {
        mutate((currentState) => focusShellCommandBar(currentState));
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
      startCommandDraft(
        config: CommandDraftConfig,
        options?: { descendantRevisionIds?: readonly string[]; focusDirection?: "down" | "up" },
      ) {
        mutate((currentState) => startCommandDraft(currentState, config, options));
      },
      enterBookmarkLeader() {
        mutate((currentState) => enterBookmarkLeader(currentState));
      },
      exitBookmarkLeader() {
        mutate((currentState) => exitBookmarkLeader(currentState));
      },
      enterExtrasMode() {
        mutate((currentState) => enterExtrasMode(currentState));
      },
      exitExtrasMode() {
        mutate((currentState) => exitExtrasMode(currentState));
      },
      startBookmarkPrompt(
        prefill: string,
        cursorOffset: number,
        options: { focusedRevisionId: string; suggestions: readonly BookmarkSuggestion[] | null },
      ) {
        mutate((currentState) => startBookmarkPrompt(currentState, prefill, cursorOffset, options));
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
      setRebaseSourceKind(kind: RebaseSourceKind, descendantIds?: readonly string[]) {
        mutate((currentState) => setRebaseSourceKind(currentState, kind, descendantIds));
      },
      setRebaseTargetKind(kind: RebaseTargetKind) {
        mutate((currentState) => setRebaseTargetKind(currentState, kind));
      },
      toggleRebaseSkipEmptied() {
        mutate((currentState) => toggleRebaseSkipEmptied(currentState));
      },
      toggleSquashAnchor(anchorIds: readonly string[]) {
        mutate((currentState) => toggleSquashAnchor(currentState, anchorIds));
      },
      toggleInterdiffSwap() {
        mutate((currentState) => toggleInterdiffSwap(currentState));
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
      toggleSearchIdOnly() {
        mutate((currentState) => toggleSearchIdOnly(currentState));
      },
    },
  };
}

import { MouseButton, TextAttributes, type MouseEvent, type ScrollBoxRenderable } from "@opentui/core";
import { For, Show, createEffect, createMemo, createRenderEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useKeyboard, useRenderer } from "@opentui/solid";
import { createCommandRunner } from "../commands/runner.ts";
import type { AppConfig, ResolvedAppConfig } from "../config/schema.ts";
import { resolveConfiguredKeymap } from "../config/index.ts";
import type { AppStore } from "../state/appStore.ts";
import { createPersistenceService } from "../persistence/service.ts";
import {
  DRAFT_PLACEHOLDER,
  getCommandChipTextForRevision,
  getCommandTargetRowId,
  getCommandTargetRevisionId,
  getDisplayedCommandSegments,
  getDisplayedCommandText,
  getExpandedRevision,
  getFocusedRevision,
  getMarkedRowIds,
  getDisplayedNotifications,
  getOperationAffectedRowIds,
  type CommandSegment,
} from "../state/store.ts";
import { logShortcutDebug } from "../debug.ts";
import { DEFAULT_REPOSITORY_LOAD_LIMIT, type JjClient } from "../jj/client.ts";
import { JjHelpCache } from "../jj/helpCache.ts";
import { runInteractiveCommand, runInteractiveShellCommand } from "../jj/process.ts";
import { isFilesOnlyRevset } from "../revset/files.ts";
import type { ChangedFile, RevisionSummary, StatusMessage } from "../domain/types.ts";
import { createJifCommandController, loadRevisionFiles } from "./controller.ts";
import { DiffViewer } from "./DiffViewer.tsx";
import { InlineConfirmation } from "./InlineConfirmation.tsx";
import { NotificationsOverlay } from "./NotificationsOverlay.tsx";
import { OperationLogEntryItem } from "./OperationLogEntryItem.tsx";
import { CommandPreview, CommandPrompt, FileSearchPrompt, RevsetPrompt, SearchPrompt } from "./prompts.tsx";
import {
  getRevisionBorderPolicy,
  type RevisionRowState,
} from "./revisionBorders.ts";
import { MessageOverlay, StatusArea } from "./statusArea.tsx";
import { createJifRuntime } from "./runtime.ts";
import {
  buildRevisionGutterPlan,
  measureBoxedGraphWidth,
  measureGutterPlanWidth,
  splitGraphTitleSegments,
} from "./revisionGutter.ts";
import { buildRevisionLayoutSpec, type RevisionSideChip } from "./revisionLayout.ts";
import {
  buildRevisionChangeIdSegments,
  formatRelativeAgo,
  getRevisionChangeIdDisplayLength,
  getRevisionCommandChipBgColor,
  getRevisionChangeIdColors,
  getRevisionDescriptionColor,
  getRevisionSelectionMarker,
} from "./revisionHeader.ts";
import { getChangedFileRowBackgroundColor, getRevisionRowBackgroundColor } from "./rowBackgrounds.ts";
import { isScrollboxAtBottom, observeScrollboxBottomReached, scrollToKeepChildVisible } from "./scroll.ts";
import { buildScrollbarTrackOptions } from "./scrollbarOptions.ts";
import {
  buildShortcutEntries,
  buildShortcutGrid,
  buildShortcutSummary,
  buildShortcutSummarySegments,
  computeShortcutPanelHeight,
  getShortcutPanelBindings,
  shortcutLayoutRowCount,
  shortcutModeLabel,
  stateChipSummaryWidth,
  type ShortcutPanelBindingInput,
  type ShortcutPanelLayout,
  type ShortcutSummarySegment,
} from "./shortcutPanel.ts";
import { resolveBottomChromeLayout } from "./bottomChrome.ts";
import { resolveKeyToken } from "./keyboard.ts";
import {
  dispatchGlobalKey,
  shouldDismissShortcutContextBeforeCommand,
  type CommandDispatchDetails,
} from "./keybindings.ts";
import {
  collectCanonicalBindingsForMode,
  collectDirectCanonicalBindingsForMode,
  collectInheritedAndGlobalCanonicalBindings,
  getActiveMode,
} from "../modes.ts";
import { getChangedFileRowState, getChangedFilesPlaceholderText } from "./revisionFiles.ts";
import { bindRefreshOnFocus, createRepositoryRefresher } from "./repositoryRefresh.ts";
import { createFocusClickGuard } from "./focusClickGuard.ts";
import { suspendProcessToShell } from "./suspend.ts";
import { openTextInEditor } from "./openTextInEditor.ts";
import { hasVisibleSearchHighlights, hasVisibleSearchScope } from "../search/matching.ts";
import { SearchHighlightLayer } from "./searchOverlay.tsx";
import { getStatusHelpToastMaxBodyHeight, getStatusToastMaxBodyHeight } from "./statusMessages.ts";
import {
  bindViewRendererEvents,
  createPaletteDetector,
  estimateInitialRevisionLoadLimit,
  queueDeferredRepositoryLoad,
  startInitialRepositoryLoad,
} from "./startup.ts";
import { executeShellCommand as executeShellTextCommand } from "../jj/process.ts";

const EXTRA_EMPTY_MESSAGE = "No extra bindings defined. Bind keys under `keymap.extra` in your config.";
const FILE_FILTER_CHIP_LABEL = "file";

export function JifView(props: {
  store: AppStore;
  client: JjClient;
  config: ResolvedAppConfig;
  rawConfig: AppConfig;
  reloadConfig: () => Promise<{ raw: AppConfig; resolved: ResolvedAppConfig }>;
}) {
  const { store, client } = props;
  const helpCache = new JjHelpCache(client);
  const [rawConfig, setRawConfig] = createSignal<AppConfig>(props.rawConfig);
  const [config, setConfig] = createStore<ResolvedAppConfig>(props.config);
  const [ready, setReady] = createSignal(false);
  const [workspaceRoot, setWorkspaceRoot] = createSignal<string | null>(null);
  const [currentRevisionLoadLimit, setCurrentRevisionLoadLimit] = createSignal(DEFAULT_REPOSITORY_LOAD_LIMIT);
  const [canLoadMoreRevisions, setCanLoadMoreRevisions] = createSignal(true);
  const [loadingMoreRevisions, setLoadingMoreRevisions] = createSignal(false);
  const renderer = useRenderer();
  const [terminalSize, setTerminalSize] = createSignal({
    width: Math.max(renderer.width, 1),
    height: Math.max(renderer.height, 1),
  });
  const persistence = createPersistenceService();
  const refreshRepository = createRepositoryRefresher({
    client,
    actions: store.actions,
    getRevsetQuery: () => store.snapshot().revsetQuery,
    onRefreshSuccess: (details) => {
      setCurrentRevisionLoadLimit(details.requestedLimit);
      setCanLoadMoreRevisions(details.canLoadMore);
    },
  });
  const commandRunner = createCommandRunner({
    actions: store.actions,
    executeCommandArgs: (commandArgs, options) => client.executeCommandArgs(commandArgs, options),
    executeShellCommand: async (commandText, options) => {
      const root = options?.cwd ?? workspaceRoot();
      if (!root) {
        throw new Error("Workspace root is unavailable.");
      }

      return await executeShellTextCommand(root, commandText, { color: true });
    },
    executeInteractiveCommandArgs: async (commandArgs, options) => {
      const root = options?.cwd ?? workspaceRoot();
      if (!root) {
        throw new Error("Workspace root is unavailable.");
      }

      renderer.suspend();
      try {
        await runInteractiveCommand(root, ["jj", ...commandArgs]);
      } finally {
        renderer.resume();
      }
    },
    executeInteractiveShellCommand: async (commandText, options) => {
      const root = options?.cwd ?? workspaceRoot();
      if (!root) {
        throw new Error("Workspace root is unavailable.");
      }

      renderer.suspend();
      try {
        await runInteractiveShellCommand(root, commandText);
      } finally {
        renderer.resume();
      }
    },
    refreshRepository,
  });
  const runtime = createJifRuntime({
    store,
    client,
    commandRunner,
    persistence,
    getWorkspaceRoot: workspaceRoot,
    getShellCwd: () => process.cwd(),
    refreshRepository,
  });
  const configuredKeymap = createMemo(() => resolveConfiguredKeymap(rawConfig().keymap));
  const focusClickGuard = createFocusClickGuard(renderer);
  onCleanup(() => focusClickGuard.dispose());
  let logViewport: ScrollBoxRenderable | undefined;
  let diffViewport: ScrollBoxRenderable | undefined;
  let helpViewport: ScrollBoxRenderable | undefined;
  const detectAndApplyPalette = createPaletteDetector({
    renderer,
    rawConfig,
    applyResolvedConfig: (nextConfig) => {
      setConfig(reconcile(nextConfig));
    },
  });
  const reloadConfig = async () => {
    const next = await props.reloadConfig();
    setRawConfig(next.raw);
    setConfig(reconcile(next.resolved));
    await detectAndApplyPalette();
    store.actions.pushEvent("Config reloaded.", "success");
  };

  onMount(() => {
    void (async () => {
      const initialRevisionLimit = initialRevisionLoadLimit();
      const initialLoad = await startInitialRepositoryLoad({
        initialRevisionLimit,
        detectAndApplyPalette,
        loadWorkspaceRoot: () => client.loadWorkspaceRoot().catch(() => null),
        loadDefaultRevset: () => client.loadDefaultRevset(),
        loadSavedRevset: (resolvedWorkspaceRoot) => persistence.loadActiveRevset(resolvedWorkspaceRoot),
        refreshRepository,
        setWorkspaceRoot,
        setRevsetQuery: (query) => {
          store.actions.setRevsetQuery(query);
        },
        focusWorkingCopy: () => {
          store.actions.focusWorkingCopy();
        },
      });
      setReady(true);
      const disposeFocusRefresh = bindRefreshOnFocus(renderer, () => refreshRepository());
      onCleanup(() => disposeFocusRefresh());
      if (canLoadMoreRevisions()) {
        queueDeferredRepositoryLoad({
          initialRevisionLimit,
          backgroundRevisionLimit: DEFAULT_REPOSITORY_LOAD_LIMIT,
          revset: initialLoad.initialRevset || undefined,
          schedule: queueMicrotask,
          refreshRepository,
        });
      }
    })();

    const disposeRendererEvents = bindViewRendererEvents({
      renderer,
      detectAndApplyPalette,
      setTerminalSize,
    });
    onCleanup(() => disposeRendererEvents());
  });

  const controller = createJifCommandController({
    store,
    client,
    destroy: () => renderer.destroy(),
    suspend: () => suspendProcessToShell({ renderer }),
    executeCurrentCommand: runtime.executeCurrentCommand,
    runJjCommand: runtime.runJjCommand,
    runShellCommand: runtime.runShellCommand,
    runInteractiveJjCommand: runtime.runInteractiveJjCommand,
    runInteractiveShellCommand: runtime.runInteractiveShellCommand,
    applyRevsetQuery: runtime.applyRevsetQuery,
    restoreLogRevsetFromFileFilter: runtime.restoreLogRevsetFromFileFilter,
    openTextInEditor: (text) => openTextInEditor({
      text,
      runInteractive: async (cwd, command) => {
        renderer.suspend();
        try {
          await runInteractiveCommand(cwd, command);
        } finally {
          renderer.resume();
        }
      },
    }),
    reloadConfig,
    refreshRepository,
    expandElidedRevisions: runtime.expandElidedRevisions,
    persistLayout: (layout) => persistence.saveLayoutPreference(layout),
    getDiffViewport: () => diffViewport,
    getHelpViewport: () => helpViewport,
    logShortcutPanelToggle: ({ before, after, focusMode }) => {
      logShortcutDebug("toggle-shortcut-panel", {
        before,
        after,
        focusMode,
      });
    },
  });

  const commandText = createMemo(() => {
    store.state.focusedRevisionIndex;
    store.state.commandDraft;
    store.state.commandBar;
    store.state.useShortFlags;
    store.state.selectedRowIds;
    return getDisplayedCommandText(store.state);
  });
  const commandSegments = createMemo((): readonly CommandSegment[] | null => {
    store.state.focusedRevisionIndex;
    store.state.commandDraft;
    store.state.commandBar;
    store.state.useShortFlags;
    store.state.selectedRowIds;
    return getDisplayedCommandSegments(store.state);
  });
  const revisionChangeIdDisplayLength = createMemo(() =>
    getRevisionChangeIdDisplayLength(
      store.state.revisions,
      config.log.revisionIdAdditionalChars,
    )
  );
  const activeMode = createMemo(() => getActiveMode(store.state));
  const commandsById = createMemo(() =>
    new Map(configuredKeymap().commands.map((command) => [command.id, command] as const))
  );
  const resolveBindings = (
    raw: readonly { key: string; commandId: string }[],
  ): readonly ShortcutPanelBindingInput[] => {
    const resolved: ShortcutPanelBindingInput[] = [];
    for (const { key, commandId } of raw) {
      const command = commandsById().get(commandId);
      if (command) resolved.push({ key, command });
    }
    return resolved;
  };
  const visibleBindings = createMemo(() =>
    resolveBindings(collectCanonicalBindingsForMode(activeMode(), configuredKeymap().keymap))
  );
  const directModeBindings = createMemo(() =>
    resolveBindings(collectDirectCanonicalBindingsForMode(activeMode(), configuredKeymap().keymap))
  );
  const inheritedAndGlobalBindings = createMemo(() =>
    resolveBindings(collectInheritedAndGlobalCanonicalBindings(activeMode(), configuredKeymap().keymap))
  );
  const shortcutBindings = createMemo(() =>
    getShortcutPanelBindings(store.state, visibleBindings())
  );
  const modeShortcutBindings = createMemo(() =>
    getShortcutPanelBindings(store.state, directModeBindings())
  );
  const shortcutInheritedBindings = createMemo(() =>
    getShortcutPanelBindings(store.state, inheritedAndGlobalBindings())
  );
  const shortcutEntries = createMemo(() => buildShortcutEntries(shortcutBindings()));
  const shortcutContentWidth = createMemo(() => Math.max(1, terminalSize().width - 4));
  const isFileFilterRevset = createMemo(() => isFilesOnlyRevset(store.state.revsetQuery));
  const shortcutSummarySegments = createMemo(() => {
    if (!isFileFilterRevset()) {
      return buildShortcutSummarySegments(shortcutEntries(), shortcutContentWidth());
    }
    // File-filter mode is just the normal summary with a leading `esc log` hint
    // and a chip on the left. Budget for the chip and fold the hint into the
    // fit so trailing hints drop gracefully instead of overflowing.
    const availableWidth = shortcutContentWidth() - stateChipSummaryWidth(FILE_FILTER_CHIP_LABEL);
    return buildShortcutSummarySegments(shortcutEntries(), availableWidth, [
      { keyLabel: "esc", label: "log" },
    ]);
  });
  const shortcutSummary = createMemo(() =>
    buildShortcutSummary(shortcutEntries(), shortcutContentWidth())
  );
  const shortcutGrid = createMemo(() =>
    buildShortcutGrid(shortcutEntries(), shortcutContentWidth())
  );
  const shortcutLayout = createMemo<ShortcutPanelLayout>(() => ({
    kind: "single",
    grid: shortcutGrid(),
  }));
  const shortcutPanelHeight = createMemo(() =>
    computeShortcutPanelHeight(terminalSize().height)
  );
  const statusToastMaxBodyHeight = createMemo(() =>
    getStatusToastMaxBodyHeight(terminalSize().height)
  );
  const shortcutPanelBodyHeight = createMemo(() =>
    Math.max(1, Math.min(shortcutLayoutRowCount(shortcutLayout()), Math.max(1, shortcutPanelHeight() - 3)))
  );
  const [promptSurfaceHeight, setPromptSurfaceHeight] = createSignal(3);
  const showsCommandPrompt = createMemo(() => store.state.focusMode === "command");
  const showsRevsetPrompt = createMemo(() => store.state.focusMode === "revset");
  const showsFileSearchPrompt = createMemo(() => store.state.focusMode === "file-search");
  const showsSearchPrompt = createMemo(() =>
    !showsCommandPrompt() && !showsRevsetPrompt() && !showsFileSearchPrompt() &&
    hasVisibleSearchScope(store.state) &&
    store.state.focusMode === "search"
  );
  const showsPersistentShortcutPanel = createMemo(() =>
    !showsCommandPrompt() && !showsRevsetPrompt() && !showsFileSearchPrompt() && !showsSearchPrompt() &&
    store.state.shortcutPanelExpanded
  );
  const showsCommandPreview = createMemo(() =>
    !showsCommandPrompt() &&
    !showsRevsetPrompt() &&
    !showsFileSearchPrompt() &&
    !showsSearchPrompt() &&
    !showsPersistentShortcutPanel() &&
    commandSegments() !== null
  );
  const initialRevisionLoadLimit = createMemo(() =>
    estimateInitialRevisionLoadLimit({
      terminalHeight: terminalSize().height,
      layout: store.state.layout,
      maximum: DEFAULT_REPOSITORY_LOAD_LIMIT,
    })
  );
  const showsTransientShortcutPanel = createMemo(() =>
    !showsPersistentShortcutPanel() && (
      store.state.focusMode === "extra" ||
      (modeShortcutBindings().length > 0 &&
        (showsCommandPreview() || store.state.focusMode === "bookmark"))
    )
  );
  const expandedShortcutBindings = createMemo(() =>
    showsTransientShortcutPanel() ? modeShortcutBindings() : shortcutBindings()
  );
  const expandedShortcutEntries = createMemo(() => buildShortcutEntries(expandedShortcutBindings()));
  const expandedShortcutGrid = createMemo(() =>
    buildShortcutGrid(expandedShortcutEntries(), shortcutContentWidth())
  );
  const persistentDirectGrid = createMemo(() =>
    buildShortcutGrid(buildShortcutEntries(modeShortcutBindings()), shortcutContentWidth())
  );
  const persistentInheritedGrid = createMemo(() =>
    buildShortcutGrid(buildShortcutEntries(shortcutInheritedBindings()), shortcutContentWidth())
  );
  const expandedShortcutLayout = createMemo<ShortcutPanelLayout>(() => {
    if (
      showsPersistentShortcutPanel() &&
      !showsTransientShortcutPanel() &&
      activeMode() !== "normal"
    ) {
      return {
        kind: "split",
        topGrid: persistentDirectGrid(),
        bottomGrid: persistentInheritedGrid(),
      };
    }
    return { kind: "single", grid: expandedShortcutGrid() };
  });
  const expandedShortcutPanelBodyHeight = createMemo(() =>
    Math.max(
      1,
      Math.min(shortcutLayoutRowCount(expandedShortcutLayout()), Math.max(1, shortcutPanelHeight() - 3)),
    )
  );
  const expandedShortcutPanelRenderedHeight = createMemo(() => expandedShortcutPanelBodyHeight() + 4);
  const loadingIndicatorText = createMemo(() => {
    if (store.state.operationLogLoading) {
      return "loading operation log";
    }

    if (loadingMoreRevisions()) {
      return "loading more revisions";
    }

    return null;
  });
  const bottomChromeLayout = createMemo(() => resolveBottomChromeLayout({
    showsCommandPrompt: showsCommandPrompt(),
    showsRevsetPrompt: showsRevsetPrompt(),
    showsFileSearchPrompt: showsFileSearchPrompt(),
    showsSearchPrompt: showsSearchPrompt(),
    showsCommandPreview: showsCommandPreview(),
    showsPersistentShortcutPanel: showsPersistentShortcutPanel(),
    showsTransientShortcutPanel: showsTransientShortcutPanel(),
    promptSurfaceHeight: promptSurfaceHeight(),
    shortcutPanelRenderedHeight: expandedShortcutPanelRenderedHeight(),
  }));
  const statusHelpToastMaxBodyHeight = createMemo(() =>
    getStatusHelpToastMaxBodyHeight(
      terminalSize().height,
      bottomChromeLayout().bottomSurfaceHeight,
    )
  );

  createEffect(() => {
    logShortcutDebug("shortcut-panel-state", {
      expanded: store.state.shortcutPanelExpanded,
      focusMode: store.state.focusMode,
    });
  });

  const dismissShortcutsBeforeCommand = (details: CommandDispatchDetails) => {
    if (!shouldDismissShortcutContextBeforeCommand(details)) {
      return;
    }

    if (store.state.shortcutPanelExpanded) {
      store.actions.closeShortcutPanel();
    }
    if (details.mode === "extra") {
      store.actions.exitExtraMode();
    } else if (details.mode === "bookmark") {
      store.actions.exitBookmarkLeader();
    }
  };

  useKeyboard((event) => {
    if (event.eventType === "release") {
      return;
    }

    const state = store.snapshot();
    const normalizedKey = resolveKeyToken(event);
    logShortcutDebug("key-event", {
      name: event.name,
      sequence: event.sequence,
      shift: event.shift,
      normalizedKey,
      focusMode: state.focusMode,
    });
    if (normalizedKey === null) {
      return;
    }

    const handled = dispatchGlobalKey({
      normalizedKey,
      state,
      commands: configuredKeymap().commands,
      controller,
      keymap: configuredKeymap().keymap,
      onBeforeCommandRun: dismissShortcutsBeforeCommand,
    });
    if (!handled) {
      logShortcutDebug("key-ignored", {
        normalizedKey,
        focusMode: state.focusMode,
      });
      return;
    }

    logShortcutDebug("key-handled", {
      normalizedKey,
      focusMode: state.focusMode,
    });
    event.preventDefault();
  }, { release: true });

  let prevFocusedIndex = store.state.focusedRevisionIndex;
  let prevFocusedOperationIndex = store.state.focusedOperationLogIndex;
  let prevFocusedEvologIndex = store.state.focusedEvologIndex;
  let prevFocusedNotificationIndex = store.state.focusedNotificationIndex;
  let prevFocusedFileIndex = store.state.focusedFileIndex;

  createRenderEffect(() => {
    if (store.state.focusMode === "op-log" || store.state.focusMode === "evolog") {
      return;
    }

    const focusedRevision = getFocusedRevision(store.state);
    if (!focusedRevision || !logViewport) {
      return;
    }

    const focusedIndex = store.state.focusedRevisionIndex;
    const direction = focusedIndex >= prevFocusedIndex ? "down" : "up";
    prevFocusedIndex = focusedIndex;

    const marginRowId = (() => {
      const margin = config.log.scrollMargin;
      const idx = direction === "down"
        ? Math.min(focusedIndex + margin, store.state.revisions.length - 1)
        : Math.max(focusedIndex - margin, 0);
      return (store.state.revisions[idx] ?? focusedRevision).rowId;
    })();

    scrollToKeepChildVisible(logViewport, `revision-${marginRowId}`, direction);
  });

  createRenderEffect(() => {
    if (store.state.focusMode !== "op-log" || !logViewport) {
      return;
    }

    const focusedEntry = store.state.operationLogEntries[store.state.focusedOperationLogIndex];
    if (!focusedEntry) {
      return;
    }

    const focusedIndex = store.state.focusedOperationLogIndex;
    const direction = focusedIndex >= prevFocusedOperationIndex ? "down" : "up";
    prevFocusedOperationIndex = focusedIndex;

    const margin = config.log.scrollMargin;
    const marginIndex = direction === "down"
      ? Math.min(focusedIndex + margin, store.state.operationLogEntries.length - 1)
      : Math.max(focusedIndex - margin, 0);

    scrollToKeepChildVisible(logViewport, `operation-log-entry-${marginIndex}`, direction);
  });

  createRenderEffect(() => {
    if (store.state.focusMode !== "evolog" || !logViewport) {
      return;
    }

    const focusedEntry = store.state.evologEntries[store.state.focusedEvologIndex];
    if (!focusedEntry) {
      return;
    }

    const focusedIndex = store.state.focusedEvologIndex;
    const direction = focusedIndex >= prevFocusedEvologIndex ? "down" : "up";
    prevFocusedEvologIndex = focusedIndex;

    const margin = config.log.scrollMargin;
    const marginIndex = direction === "down"
      ? Math.min(focusedIndex + margin, store.state.evologEntries.length - 1)
      : Math.max(focusedIndex - margin, 0);

    scrollToKeepChildVisible(logViewport, `evolog-entry-${marginIndex}`, direction);
  });

  createRenderEffect(() => {
    if (store.state.focusMode !== "notifications" || !logViewport) {
      return;
    }

    if (store.state.eventLog.length === 0) {
      return;
    }

    const focusedIndex = store.state.focusedNotificationIndex;
    const direction = focusedIndex >= prevFocusedNotificationIndex ? "down" : "up";
    prevFocusedNotificationIndex = focusedIndex;

    scrollToKeepChildVisible(logViewport, `notification-${focusedIndex}`, direction);
  });

  createRenderEffect(() => {
    if (store.state.focusMode !== "files" || !logViewport) {
      return;
    }

    const expandedId = store.state.expandedRowId;
    if (!expandedId) {
      return;
    }

    const revision = getExpandedRevision(store.state);
    const fileCount = revision?.files.length ?? 0;
    if (fileCount === 0) {
      return;
    }

    const focusedIndex = store.state.focusedFileIndex;
    const direction = focusedIndex >= prevFocusedFileIndex ? "down" : "up";
    prevFocusedFileIndex = focusedIndex;

    const margin = config.log.scrollMargin;
    const marginIndex = direction === "down"
      ? Math.min(focusedIndex + margin, fileCount - 1)
      : Math.max(focusedIndex - margin, 0);

    scrollToKeepChildVisible(logViewport, `file-row-${expandedId}-${marginIndex}`, direction);
  });

  createRenderEffect(() => {
    const expandedId = store.state.expandedRowId;
    if (!expandedId || !logViewport) {
      return;
    }

    const child = logViewport.findDescendantById(`revision-${expandedId}`);
    if (!child) {
      return;
    }

    const vpTop = logViewport.viewport.y;
    const vpHeight = logViewport.viewport.height;
    const vpBottom = vpTop + vpHeight;

    if (child.height > vpHeight) {
      logViewport.scrollBy(child.y - vpTop);
    } else if (child.y + child.height > vpBottom) {
      logViewport.scrollBy(child.y + child.height - vpBottom);
    }
  });

  const maybeLoadMoreRevisions = async (): Promise<void> => {
    if (store.state.loading || loadingMoreRevisions() || !canLoadMoreRevisions() || store.state.revisions.length === 0) {
      return;
    }

    const nextLimit = Math.max(currentRevisionLoadLimit(), store.state.revisions.length) + DEFAULT_REPOSITORY_LOAD_LIMIT;
    setLoadingMoreRevisions(true);
    try {
      await refreshRepository(undefined, nextLimit);
    } finally {
      setLoadingMoreRevisions(false);
    }
  };

  createRenderEffect(() => {
    if (store.state.focusMode !== "revisions") {
      return;
    }

    if (store.state.revisions.length === 0) {
      return;
    }

    if (store.state.focusedRevisionIndex === store.state.revisions.length - 1) {
      void maybeLoadMoreRevisions();
    }
  });

  createEffect(() => {
    if (!ready() || !logViewport) {
      return;
    }

    const disposeScrollObserver = observeScrollboxBottomReached(logViewport, () => {
      if (store.state.focusMode === "revisions" && isScrollboxAtBottom(logViewport!)) {
        void maybeLoadMoreRevisions();
      }
    });
    onCleanup(() => disposeScrollObserver());
  });

  createEffect(() => {
    const expandedRowId = store.state.expandedRowId;
    if (!expandedRowId) {
      return;
    }
    const revision = store.state.revisions.find((r) => r.rowId === expandedRowId);
    if (!revision || revision.filesLoaded) {
      return;
    }
    void loadRevisionFiles({
      client,
      store,
      rowId: revision.rowId,
      revisionId: revision.revisionId,
      hasConflict: revision.hasConflict,
    });
  });



  return (
    <Show when={ready()}>
      <box
        width="100%"
        height="100%"
        flexDirection="column"
        backgroundColor={config.colorScheme.semanticColors.chromeFillOne}
      >
        <Show
          when={store.state.focusMode === "diff-viewer" && store.state.diffViewer}
          fallback={(
            <scrollbox
              ref={logViewport}
              width="100%"
              flexGrow={1}
              scrollY
              scrollbarOptions={buildScrollbarTrackOptions(
                config.colorScheme.semanticColors.chromeFillThree,
                config.colorScheme.semanticColors.chromeScrollbarThumb,
              )}
            >
              <box width="100%" flexDirection="column">
                <Show
                  when={store.state.focusMode === "notifications"}
                  fallback={(
                    <Show
                      when={store.state.focusMode === "op-log"}
                      fallback={(
                        <Show
                          when={store.state.focusMode === "evolog"}
                          fallback={(
                            <For each={store.state.revisions}>
                              {(revision, index) => (
                                <RevisionItem
                                  state={store.state}
                                  revision={revision}
                                  revisionChangeIdDisplayLength={revisionChangeIdDisplayLength()}
                                  index={index()}
                                  previousRowId={store.state.revisions[index() - 1]?.rowId ?? null}
                                  nextRowId={store.state.revisions[index() + 1]?.rowId ?? null}
                                  config={config}
                                  focusedRowId={getFocusedRevision(store.state)?.rowId ?? null}
                                  selectedRowIds={getMarkedRowIds(store.state)}
                                  expandedRowId={getExpandedRevision(store.state)?.rowId ?? null}
                                  commandTargetRowId={getCommandTargetRowId(store.state)}
                                  onMouseFocus={() => {
                                    if (focusClickGuard.isWithinFocusGrace()) return;
                                    store.actions.focusRevisionAt(index());
                                  }}
                                />
                              )}
                            </For>
                          )}
                        >
                          <Show
                            when={store.state.evologEntries.length > 0}
                            fallback={(
                              <box width="100%" paddingX={1} paddingY={1}>
                                <text fg={config.colorScheme.semanticColors.textTertiary}>
                                  {store.state.evologLoading ? "Loading evolog..." : "No evolog entries."}
                                </text>
                              </box>
                            )}
                          >
                            <For each={store.state.evologEntries}>
                              {(entry, index) => (
                                <OperationLogEntryItem
                                  id={`evolog-entry-${index()}`}
                                  entry={entry}
                                  focused={store.state.focusedEvologIndex === index()}
                                  config={config}
                                  onMouseFocus={() => {
                                    if (focusClickGuard.isWithinFocusGrace()) return;
                                    store.actions.focusEvologEntryAt(index());
                                  }}
                                />
                              )}
                            </For>
                          </Show>
                        </Show>
                      )}
                    >
                      <Show
                        when={store.state.operationLogEntries.length > 0}
                        fallback={(
                          <box width="100%" paddingX={1} paddingY={1}>
                            <text fg={config.colorScheme.semanticColors.textTertiary}>
                              {store.state.operationLogLoading ? "Loading operation log..." : "No operation log entries."}
                            </text>
                          </box>
                        )}
                      >
                        <For each={store.state.operationLogEntries}>
                          {(entry, index) => (
                            <OperationLogEntryItem
                              id={`operation-log-entry-${index()}`}
                              entry={entry}
                              focused={store.state.focusedOperationLogIndex === index()}
                              config={config}
                              onMouseFocus={() => {
                                if (focusClickGuard.isWithinFocusGrace()) return;
                                store.actions.focusOperationLogEntryAt(index());
                              }}
                            />
                          )}
                        </For>
                      </Show>
                    </Show>
                  )}
                >
                  <NotificationsOverlay
                    entries={getDisplayedNotifications(store.state)}
                    focusedIndex={store.state.focusedNotificationIndex}
                    expandedIds={store.state.expandedNotificationIds}
                    config={config}
                    onFocusEntry={(index) => {
                      if (focusClickGuard.isWithinFocusGrace()) return;
                      store.actions.focusNotificationAt(index);
                    }}
                  />
                </Show>
              </box>
            </scrollbox>
          )}
        >
          <box width="100%" flexGrow={1}>
            <DiffViewer
              state={store.state.diffViewer!}
              config={config}
              registerScrollbox={(el) => {
                diffViewport = el;
              }}
            />
          </box>
        </Show>
        <Show when={bottomChromeLayout().showExpandedShortcutPanel}>
          <StatusArea
            shortcutSummary={shortcutSummary()}
            shortcutSummarySegments={shortcutSummarySegments()}
            shortcutLayout={expandedShortcutLayout()}
            expanded
            currentModeLabel={shortcutModeLabel(activeMode())}
            panelBodyHeight={expandedShortcutPanelBodyHeight()}
            actionLabel={showsPersistentShortcutPanel() ? "? close" : null}
            config={config}
            loadingIndicatorText={loadingIndicatorText()}
            emptyMessage={activeMode() === "extra" ? EXTRA_EMPTY_MESSAGE : undefined}
          />
        </Show>
        <Show when={showsCommandPrompt()}>
          <CommandPrompt
            store={store}
            config={config}
            client={client}
            helpCache={helpCache}
            composeEnabled={store.state.commandBar.kind === "jj"}
            startInCompose={store.state.commandBar.startInCompose ?? false}
            workspaceRoot={workspaceRoot()}
            loadHistory={(root) => store.state.commandBar.kind === "shell"
              ? persistence.loadShellHistory(root)
              : persistence.loadCommandHistory(root)}
            removeHistory={(root, entry) => store.state.commandBar.kind === "shell"
              ? persistence.removeShellHistory(root, entry)
              : persistence.removeCommandHistory(root, entry)}
            commandText={commandText()}
            prefix={store.state.commandBar.kind === "shell" ? "❯ " : "jj "}
            placeholder={store.state.commandBar.kind === "shell" ? "shell command" : "subcommand"}
            bookmarkContext={store.state.commandBarBookmark
              ? {
                  initialCursorOffset: store.state.commandBarBookmark.initialCursorOffset,
                  suggestions: store.state.commandBarBookmark.suggestions,
                }
              : null}
            onSubmit={(value) => {
              store.actions.setCommandBarText(value);
              void runtime.executeCurrentCommand(value, { recordHistory: true });
            }}
            onHeightChange={setPromptSurfaceHeight}
          />
        </Show>
        <Show when={showsRevsetPrompt()}>
          <RevsetPrompt
            revsetQuery={store.state.revsetQuery}
            initialQuery={store.state.revsetInputQuery}
            client={client}
            config={config}
            workspaceRoot={workspaceRoot()}
            loadHistory={(root) => persistence.loadRevsetHistory(root)}
            removeHistory={(root, entry) => persistence.removeRevsetHistory(root, entry)}
            onApply={runtime.applyRevsetQuery}
            onCancel={() => {
              store.actions.closeRevsetInput();
            }}
            onHeightChange={setPromptSurfaceHeight}
          />
        </Show>
        <Show when={showsFileSearchPrompt()}>
          <FileSearchPrompt
            client={client}
            config={config}
            onApply={(query) => {
              store.actions.closeFileSearch();
              void runtime.applyRevsetQuery(query);
            }}
            onEditRevset={(query) => {
              store.actions.closeFileSearch();
              store.actions.openRevsetInput(query);
            }}
            onCancel={() => {
              store.actions.closeFileSearch();
            }}
            onHeightChange={setPromptSurfaceHeight}
          />
        </Show>
        <Show when={showsSearchPrompt()}>
          <SearchPrompt
            store={store}
            config={config}
            focused={store.state.focusMode === "search"}
            searchQuery={store.state.searchQuery}
            searchIdOnly={store.state.searchIdOnly}
            onHeightChange={setPromptSurfaceHeight}
          />
        </Show>
        <Show when={showsCommandPreview()}>
          <CommandPreview
            config={config}
            commandSegments={commandSegments()!}
            onHeightChange={setPromptSurfaceHeight}
          />
        </Show>
        <Show when={bottomChromeLayout().showCollapsedStatusArea}>
          <StatusArea
            shortcutSummary={shortcutSummary()}
            shortcutSummarySegments={shortcutSummarySegments()}
            shortcutLayout={shortcutLayout()}
            expanded={false}
            currentModeLabel={shortcutModeLabel(activeMode())}
            panelBodyHeight={shortcutPanelBodyHeight()}
            config={config}
            stateChipLabel={isFileFilterRevset() ? FILE_FILTER_CHIP_LABEL : null}
            loadingIndicatorText={loadingIndicatorText()}
          />
        </Show>
        <MessageOverlay
          messages={store.state.statusMessages}
          loading={store.state.loading}
          config={config}
          bottomInset={bottomChromeLayout().bottomSurfaceHeight}
          maxToastBodyHeight={statusToastMaxBodyHeight()}
          maxHelpToastBodyHeight={statusHelpToastMaxBodyHeight()}
          registerHelpViewport={(el) => { helpViewport = el; }}
          onInteract={(id) => store.actions.touchStatusMessage(id)}
          onDismiss={(id) => store.actions.dismissStatusMessage(id)}
        />
        <Show when={hasVisibleSearchHighlights(store.state)}>
          <SearchHighlightLayer
            state={store.state}
            config={config}
            getViewport={() => logViewport}
          />
        </Show>
      </box>
    </Show>
  );

}

export function RevisionItem(props: {
  state: AppStore["state"];
  revision: RevisionSummary;
  revisionChangeIdDisplayLength?: number;
  index: number;
  previousRowId: string | null;
  nextRowId: string | null;
  config: ResolvedAppConfig;
  focusedRowId: string | null;
  selectedRowIds: ReadonlySet<string>;
  expandedRowId: string | null;
  commandTargetRowId: string | null;
  onMouseFocus?: () => void;
}) {
  const renderer = useRenderer();
  const colors = () => props.config.colorScheme.semanticColors;
  const affectedIds = createMemo(() => getOperationAffectedRowIds(props.state));
  const isFocused = () => props.revision.rowId === props.focusedRowId;
  const isSelected = () => props.selectedRowIds.has(props.revision.rowId);
  const isExpanded = () => props.revision.rowId === props.expandedRowId;
  const anyExpanded = () => props.expandedRowId !== null;
  const isAffected = () => affectedIds().has(props.revision.rowId);
  const isCommandTarget = () => props.commandTargetRowId === props.revision.rowId;
  const inlineConfirmation = createMemo(() =>
    props.state.inlineConfirmation?.rowId === props.revision.rowId
      ? props.state.inlineConfirmation
      : null
  );
  const revisionChangeIdDisplayLength = createMemo(() =>
    props.revisionChangeIdDisplayLength
      ?? getRevisionChangeIdDisplayLength(
        props.state.revisions,
        props.config.log.revisionIdAdditionalChars,
      )
  );
  const commandChipText = createMemo(() => getCommandChipTextForRevision(props.state, props.revision.rowId));
  const changedFileRows = createMemo(() => isExpanded() ? buildChangedFileDisplayRows(props.revision) : []);
  const rowState = createMemo(() =>
    getRevisionRowState(props.revision.rowId, props.focusedRowId, props.selectedRowIds) ?? "default",
  );
  const previousRowState = createMemo(() =>
    getRevisionRowState(props.previousRowId, props.focusedRowId, props.selectedRowIds),
  );
  const nextRowState = createMemo(() =>
    getRevisionRowState(props.nextRowId, props.focusedRowId, props.selectedRowIds),
  );
  const detailRowCount = () => isExpanded()
    ? Math.max(props.revision.files.length, 1) + (inlineConfirmation() ? 1 : 0)
    : 0;
  const layoutSpec = createMemo(() =>
    buildRevisionLayoutSpec(props.revision, {
      mode: props.state.layout,
      commandChipText: commandChipText(),
    }),
  );
  const boxedGraphWidth = createMemo(() =>
    measureBoxedGraphWidth({
      graphRows: props.revision.graphRows,
      baseGraphRowCount: layoutSpec().baseGraphRowCount,
      visibleGraphMode: layoutSpec().visibleGraphMode,
    })
  );
  const previousBoxedGraphWidth = createMemo(() => {
    const prev = props.index > 0 ? props.state.revisions[props.index - 1] : null;
    if (!prev) {
      return null;
    }

    const previousLayoutSpec = buildRevisionLayoutSpec(prev, {
      mode: props.state.layout,
      commandChipText: null,
    });

    return measureBoxedGraphWidth({
      graphRows: prev.graphRows,
      baseGraphRowCount: previousLayoutSpec.baseGraphRowCount,
      visibleGraphMode: previousLayoutSpec.visibleGraphMode,
    });
  });
  const nextBoxedGraphWidth = createMemo(() => {
    const next = props.state.revisions[props.index + 1] ?? null;
    if (!next) {
      return null;
    }

    const nextLayoutSpec = buildRevisionLayoutSpec(next, {
      mode: props.state.layout,
      commandChipText: null,
    });

    return measureBoxedGraphWidth({
      graphRows: next.graphRows,
      baseGraphRowCount: nextLayoutSpec.baseGraphRowCount,
      visibleGraphMode: nextLayoutSpec.visibleGraphMode,
    });
  });
  const effectiveRowState = createMemo((): RevisionRowState => {
    const rs = rowState();
    if (rs === "default" && isAffected()) return "affected";
    return rs;
  });
  const previousEffectiveRowState = createMemo((): RevisionRowState | null => {
    const rs = previousRowState();
    if (rs === "default" && props.previousRowId !== null && affectedIds().has(props.previousRowId)) return "affected";
    return rs;
  });
  const nextEffectiveRowState = createMemo((): RevisionRowState | null => {
    const rs = nextRowState();
    if (rs === "default" && props.nextRowId !== null && affectedIds().has(props.nextRowId)) return "affected";
    return rs;
  });
  const usesExternalGraphSpacer = createMemo(() =>
    layoutSpec().visibleGraphMode === "keep-second-row"
  );
  const previousUsesExternalGraphSpacer = createMemo(() => {
    const previous = props.index > 0 ? props.state.revisions[props.index - 1] : null;
    if (!previous) {
      return false;
    }

    return buildRevisionLayoutSpec(previous, {
      mode: props.state.layout,
      commandChipText: null,
    }).visibleGraphMode === "keep-second-row";
  });
  const sharesTopBorder = createMemo(() => !previousUsesExternalGraphSpacer());
  const sharesBottomBorder = createMemo(() => !usesExternalGraphSpacer());
  const borderPolicy = createMemo(() => getRevisionBorderPolicy({
    rowState: effectiveRowState(),
    previousRowState: sharesTopBorder() ? previousEffectiveRowState() : null,
    nextRowState: sharesBottomBorder() ? nextEffectiveRowState() : null,
    currentGraphWidth: boxedGraphWidth(),
    previousGraphWidth: sharesTopBorder() ? previousBoxedGraphWidth() : null,
    nextGraphWidth: sharesBottomBorder() ? nextBoxedGraphWidth() : null,
  }));
  const gutterPlan = createMemo(() => buildRevisionGutterPlan({
    graphRows: props.revision.graphRows,
    baseGraphRowCount: layoutSpec().baseGraphRowCount,
    visibleGraphMode: layoutSpec().visibleGraphMode,
    detailRowCount: detailRowCount(),
    ownsTop: borderPolicy().ownsTop,
    ownsBottom: borderPolicy().ownsBottom,
    previousGraphBottom: (() => {
      const prev = props.index > 0 ? props.state.revisions[props.index - 1] : null;
      if (!prev) return null;
      return prev.graphRows.at(-1) ?? prev.graphRows[0] ?? null;
    })(),
    hasNextRevision: props.index + 1 < props.state.revisions.length,
  }));
  const inlineGraphTail = createMemo(() =>
    usesExternalGraphSpacer() ? [] : gutterPlan().tail
  );
  const externalGraphRows = createMemo(() => {
    if (!usesExternalGraphSpacer()) {
      return [];
    }

    return [...gutterPlan().tail];
  });
  const inlineBottomDivider = createMemo(() => gutterPlan().bottomDivider);
  const fullGraphWidth = createMemo(() => measureGutterPlanWidth(gutterPlan()));
  const inlineGraphWidth = createMemo(() =>
    usesExternalGraphSpacer() ? boxedGraphWidth() : fullGraphWidth()
  );
  const currentLeftCol = () => boxedGraphWidth() + 1;
  const prevLeftCol = () => previousBoxedGraphWidth() !== null ? previousBoxedGraphWidth()! + 1 : null;
  const connectedPrevLeftCol = () => sharesTopBorder() ? prevLeftCol() : null;
  const nextLeftCol = () => nextBoxedGraphWidth() !== null ? nextBoxedGraphWidth()! + 1 : null;
  const connectedNextLeftCol = () => sharesBottomBorder() ? nextLeftCol() : null;
  const borderColor = createMemo(() =>
    rowState() === "selected"
      ? colors().rowBorderSelected
      : rowState() === "focused"
        ? colors().rowBorderFocus
        : isCommandTarget()
        ? colors().rowBorderCommandTarget
        : colors().rowBorderIdle
  );
  const titleGraphColor = createMemo(() => markerColor(props.revision, colors()));
  const continuationGraphColor = createMemo(() => colors().textTertiary);
  const descriptionColor = createMemo(() =>
    getRevisionDescriptionColor(props.revision, {
      rowState: effectiveRowState(),
      colors: colors(),
    })
  );
  const rowBackgroundColor = createMemo(() =>
    getRevisionRowBackgroundColor({
      focused: isFocused(),
      selected: isSelected(),
      affected: isAffected(),
      colors: colors(),
    })
  );
  const isCommandSource = createMemo(() =>
    props.state.commandDraft !== null &&
    props.state.selectedRowIds.includes(props.revision.rowId) &&
    !isCommandTarget()
  );
  const isAbsorbDefaultDeselected = createMemo(() => {
    const draft = props.state.commandDraft;
    return draft?.config.kind === "absorb" &&
      (draft.absorbDefaultRowIds ?? []).includes(props.revision.rowId) &&
      !props.state.selectedRowIds.includes(props.revision.rowId);
  });
  const commandChipBackgroundColor = createMemo(() =>
    isAbsorbDefaultDeselected()
      ? colors().chromeFillThree
      : getRevisionCommandChipBgColor({
        rowState: isCommandSource() ? "selected" : effectiveRowState(),
        colors: colors(),
      })
  );
  // The dim "default" chip needs foreground-derived text to stay legible on the
  // faint track-colored fill; other chips keep the high-contrast background tone.
  const commandChipForegroundColor = createMemo(() =>
    isAbsorbDefaultDeselected() ? colors().textTertiary : colors().chromeFillOne
  );
  const relativeAgo = createMemo(() =>
    formatRelativeAgo(props.revision.localTimestamp, new Date(props.state.lastRefreshedAt))
  );
  const superGutterPlan = createMemo(() => buildRevisionGutterPlan({
    graphRows: props.revision.graphRows,
    baseGraphRowCount: layoutSpec().baseGraphRowCount,
    visibleGraphMode: layoutSpec().visibleGraphMode,
    detailRowCount: changedFileRows().length + (inlineConfirmation() ? 1 : 0),
    ownsTop: false,
    ownsBottom: false,
    previousGraphBottom: null,
    hasNextRevision: false,
  }));
  const superGraphWidth = createMemo(() => measureGutterPlanWidth(superGutterPlan()));

  return (
    <box
      id={`revision-${props.revision.rowId}`}
      width="100%"
      flexDirection="column"
      opacity={anyExpanded() && !isExpanded() ? 0.6 : 1}
      onMouseDown={(event: MouseEvent) => {
        if (event.button !== MouseButton.LEFT) return;
        props.onMouseFocus?.();
      }}
    >
      <Show
        when={layoutSpec().mode === "tight"}
        fallback={
          <box width="100%" flexDirection="row" position="relative">
            <box width={inlineGraphWidth()} flexDirection="column">
              {gutterPlan().topDivider !== null ? (
                <text fg={continuationGraphColor()}>
                  {padRight(gutterPlan().topDivider!, inlineGraphWidth())}
                </text>
              ) : null}
              <box flexDirection="row" height={1}>
                <For each={splitGraphTitleSegments(padRight(gutterPlan().title, inlineGraphWidth()))}>
                  {(segment) => (
                    <text
                      fg={segment.isMarker && props.revision.hasConflict ? colors().statusError : titleGraphColor()}
                      attributes={segment.isMarker && props.revision.hasConflict ? TextAttributes.BOLD : undefined}
                    >
                      {segment.text}
                    </text>
                  )}
                </For>
              </box>
              <Show when={layoutSpec().headerRowCount === 2 && props.revision.marker !== "elided"}>
                <text fg={continuationGraphColor()}>
                  {padRight(gutterPlan().subtitle, inlineGraphWidth())}
                </text>
              </Show>
              <For each={inlineGraphTail()}>
                {(graphLine) => (
                  <text fg={continuationGraphColor()}>
                    {padRight(graphLine, inlineGraphWidth())}
                  </text>
                )}
              </For>
              <For each={gutterPlan().detail}>
                {(graphLine) => (
                  <text fg={continuationGraphColor()}>
                    {padRight(graphLine, inlineGraphWidth())}
                  </text>
                )}
              </For>
              {inlineBottomDivider() !== null ? (
                <text fg={continuationGraphColor()}>
                  {padRight(inlineBottomDivider()!, inlineGraphWidth())}
                </text>
              ) : null}
            </box>
            <box width={1} />
            <box
              flexGrow={1}
              flexDirection="column"
              backgroundColor={rowBackgroundColor()}
              border={borderPolicy().borderSides}
              borderStyle="single"
              borderColor={borderColor()}
              customBorderChars={borderPolicy().borderChars}
            >
              <Show
                when={props.revision.marker !== "elided"}
                fallback={
                  <text width="100%" fg={colors().textTertiary} wrapMode="none" truncate={true}>
                    {props.revision.description}
                  </text>
                }
              >
                <Show
                  when={layoutSpec().headerRowCount === 1}
                  fallback={
                    <>
                      <box width="100%" flexDirection="row">
                        <RevisionChangeId
                          revision={props.revision}
                          displayLength={revisionChangeIdDisplayLength()}
                          rowState={effectiveRowState()}
                          colors={colors()}
                        />
                        <text fg={colors().rowSelectedAccent} attributes={TextAttributes.BOLD}>
                          {getRevisionSelectionMarker(effectiveRowState())}
                        </text>
                        <box flexGrow={1} />
                        <DateChip text={relativeAgo()} colors={colors()} />
                        {layoutSpec().commandChip ? (
                          <CommandChip
                            text={layoutSpec().commandChip!.text}
                            backgroundColor={commandChipBackgroundColor()}
                            foregroundColor={commandChipForegroundColor()}
                            colors={colors()}
                          />
                        ) : null}
                      </box>
                      <box width="100%" flexDirection="row">
                        <box flexDirection="row" flexShrink={0}>
                          <Show when={layoutSpec().sideChips.length > 0}>
                            <RevisionSideChips chips={layoutSpec().sideChips} colors={colors()} />
                            <box width={1} />
                          </Show>
                        </box>
                        <box flexGrow={1} minWidth={0} height={1} overflow="hidden" flexDirection="row">
                          <text
                            flexGrow={1}
                            flexBasis={0}
                            minWidth={0}
                            fg={descriptionColor()}
                            wrapMode="none"
                            truncate={true}
                          >
                            {props.revision.description}
                          </text>
                        </box>
                      </box>
                    </>
                  }
                >
                  <box
                    width="100%"
                    height={layoutSpec().headerRowCount}
                    overflow={layoutSpec().headerRowCount === 1 ? "hidden" : undefined}
                    position="relative"
                  >
                    <box width="100%" height={1} flexDirection="row">
                      <RevisionChangeId
                        revision={props.revision}
                        displayLength={revisionChangeIdDisplayLength()}
                        rowState={effectiveRowState()}
                        colors={colors()}
                      />
                      <text fg={colors().rowSelectedAccent} attributes={TextAttributes.BOLD}>
                        {getRevisionSelectionMarker(effectiveRowState())}
                      </text>
                      <RevisionSideChips chips={layoutSpec().sideChips} colors={colors()} />
                      <Show when={layoutSpec().sideChips.length > 0}>
                        <box width={1} />
                      </Show>
                      <box flexGrow={1} flexBasis={0} minWidth={0} height={1} overflow="hidden" flexDirection="row">
                        <text
                          flexGrow={1}
                          flexBasis={0}
                          minWidth={0}
                          fg={descriptionColor()}
                          wrapMode="none"
                          truncate={true}
                        >
                          {props.revision.description}
                        </text>
                      </box>
                      <DateChip text={relativeAgo()} colors={colors()} />
                    </box>
                    {layoutSpec().commandChip?.placement === "overlay" ? (
                      <text
                        position="absolute"
                        right={0}
                        top={0}
                        zIndex={1}
                        fg={commandChipForegroundColor()}
                        bg={commandChipBackgroundColor()}
                      >
                        {` ${layoutSpec().commandChip!.text} `}
                      </text>
                    ) : null}
                  </box>
                </Show>
                <For each={inlineGraphTail()}>
                  {() => <box width="100%" height={1} />}
                </For>
                {isExpanded() ? (
                  <ChangedFiles
                    state={props.state}
                    revision={props.revision}
                    config={props.config}
                  />
                ) : null}
              </Show>
            </box>
            {borderPolicy().ownsTop && connectedPrevLeftCol() !== null && currentLeftCol() < connectedPrevLeftCol()! ? (
              <text position="absolute" left={connectedPrevLeftCol()!} top={0} zIndex={1} fg={borderColor()}>┴</text>
            ) : null}
            {borderPolicy().ownsTop && connectedPrevLeftCol() !== null && currentLeftCol() > connectedPrevLeftCol()! ? (
              <text position="absolute" left={connectedPrevLeftCol()!} top={0} zIndex={1} fg={borderColor()}>
                {"└" + "─".repeat(currentLeftCol() - connectedPrevLeftCol()! - 1)}
              </text>
            ) : null}
            {borderPolicy().ownsBottom && connectedNextLeftCol() !== null && currentLeftCol() < connectedNextLeftCol()! ? (
              <text position="absolute" left={connectedNextLeftCol()!} bottom={0} zIndex={1} fg={borderColor()}>┬</text>
            ) : null}
            {borderPolicy().ownsBottom && connectedNextLeftCol() !== null && currentLeftCol() > connectedNextLeftCol()! ? (
              <text position="absolute" left={connectedNextLeftCol()!} bottom={0} zIndex={1} fg={borderColor()}>
                {"┌" + "─".repeat(currentLeftCol() - connectedNextLeftCol()! - 1)}
              </text>
            ) : null}
          </box>
        }
      >
        <box width="100%" flexDirection="row" position="relative">
          <box width={superGraphWidth()} flexDirection="row" height={1}>
            <For each={splitGraphTitleSegments(padRight(superGutterPlan().title, superGraphWidth()))}>
              {(segment) => (
                <text
                  fg={segment.isMarker && props.revision.hasConflict ? colors().statusError : titleGraphColor()}
                  attributes={segment.isMarker && props.revision.hasConflict ? TextAttributes.BOLD : undefined}
                >
                  {segment.text}
                </text>
              )}
            </For>
          </box>
          <box width={1} />
          <box
            flexGrow={1}
            minWidth={0}
            height={1}
            overflow="hidden"
            flexDirection="row"
            backgroundColor={rowBackgroundColor()}
          >
            <Show
              when={props.revision.marker !== "elided"}
              fallback={
                <text flexGrow={1} flexBasis={0} minWidth={0} fg={colors().textTertiary} wrapMode="none" truncate={true}>
                  {props.revision.description}
                </text>
              }
            >
              <RevisionChangeId
                revision={props.revision}
                displayLength={revisionChangeIdDisplayLength()}
                rowState={effectiveRowState()}
                colors={colors()}
              />
              <text fg={colors().rowSelectedAccent} attributes={TextAttributes.BOLD}>
                {getRevisionSelectionMarker(effectiveRowState())}
              </text>
              <Show when={layoutSpec().sideChips.length > 0}>
                <RevisionSideChips chips={layoutSpec().sideChips} colors={colors()} />
                <box width={1} />
              </Show>
              <text
                flexGrow={1}
                flexBasis={0}
                minWidth={0}
                fg={descriptionColor()}
                wrapMode="none"
                truncate={true}
              >
                {props.revision.description}
              </text>
              <box width={1} />
              <DateChip text={relativeAgo()} colors={colors()} />
            </Show>
          </box>
          {layoutSpec().commandChip?.placement === "overlay" ? (
            <text
              position="absolute"
              right={0}
              top={0}
              zIndex={50}
              fg={commandChipForegroundColor()}
              bg={commandChipBackgroundColor()}
            >
              {` ${layoutSpec().commandChip!.text} `}
            </text>
          ) : null}
        </box>
        <For each={superGutterPlan().tail}>
          {(graphLine) => (
            <box width="100%" flexDirection="row">
              <text fg={continuationGraphColor()}>
                {padRight(graphLine, superGraphWidth())}
              </text>
              <box width={1} />
              <box flexGrow={1} height={1} />
            </box>
          )}
        </For>
        <For each={changedFileRows()}>
          {(row, index) => (
            <box width="100%" flexDirection="row">
              <text fg={continuationGraphColor()}>
                {padRight(superGutterPlan().detail[index()] ?? "", superGraphWidth())}
              </text>
              <box width={1} />
              <box flexGrow={1}>
                <ChangedFileRowContent
                  state={props.state}
                  rowId={props.revision.rowId}
                  row={row}
                  config={props.config}
                />
              </box>
            </box>
          )}
        </For>
        {inlineConfirmation()
          ? (
            <box width="100%" flexDirection="row">
              <text fg={continuationGraphColor()}>
                {padRight(superGutterPlan().detail[changedFileRows().length] ?? "", superGraphWidth())}
              </text>
              <box width={1} />
              <box flexGrow={1}>
                <InlineConfirmation
                  config={props.config}
                  message={inlineConfirmation()!.message}
                  options={inlineConfirmation()!.options}
                  selectedOption={inlineConfirmation()!.selectedOption}
                />
              </box>
            </box>
          )
          : null}
      </Show>
      <Show when={layoutSpec().mode !== "tight"}>
        <For each={externalGraphRows()}>
          {(graphLine) => (
            <box width="100%" flexDirection="row">
              <text fg={continuationGraphColor()}>
                {padRight(graphLine, fullGraphWidth())}
              </text>
              <box width={1} />
              <box flexGrow={1} height={1} />
            </box>
          )}
        </For>
      </Show>
    </box>
  );
}

function RevisionChangeId(props: {
  revision: Pick<RevisionSummary, "revisionId" | "changeIdPrefixLength">;
  displayLength: number;
  rowState: RevisionRowState;
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
}) {
  const segments = createMemo(() =>
    buildRevisionChangeIdSegments(props.revision, {
      displayLength: props.displayLength,
    })
  );
  const changeIdColors = createMemo(() =>
    getRevisionChangeIdColors({
      rowState: props.rowState,
      colors: props.colors,
    })
  );

  return (
    <box flexDirection="row" flexShrink={0}>
      <For each={segments()}>
        {(segment) => (
          <text
            fg={segment.kind === "prefix" ? changeIdColors().prefix : changeIdColors().suffix}
            attributes={segment.kind === "prefix" ? TextAttributes.BOLD : undefined}
          >
            {segment.text}
          </text>
        )}
      </For>
    </box>
  );
}

function CommandChip(props: {
  text: string;
  backgroundColor: string | undefined;
  foregroundColor: string | undefined;
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
}) {
  return (
    <text fg={props.foregroundColor ?? props.colors.chromeFillOne} bg={props.backgroundColor}>
      {` ${props.text} `}
    </text>
  );
}

function DateChip(props: {
  text: string;
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
}) {
  return (
    <Show when={props.text.length > 0}>
      <text flexShrink={0} fg={props.colors.textTertiary}>
        {` ${props.text} `}
      </text>
    </Show>
  );
}

type ChangedFileDisplayRow =
  | Readonly<{ kind: "placeholder"; text: string }>
  | Readonly<{ kind: "file"; file: ChangedFile; index: number }>;

function buildChangedFileDisplayRows(
  revision: Pick<RevisionSummary, "isEmpty" | "filesLoaded" | "files">,
): readonly ChangedFileDisplayRow[] {
  const placeholderText = getChangedFilesPlaceholderText(revision);
  if (placeholderText) {
    return [{ kind: "placeholder", text: placeholderText }];
  }

  return revision.files.map((file, index) => ({ kind: "file", file, index }));
}

function RevisionSideChips(props: {
  chips: readonly RevisionSideChip[];
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
}) {
  return (
    <box flexDirection="row" flexShrink={0} gap={1}>
      <For each={props.chips}>
        {(chip) => {
          return (
            <text
              fg={chip.kind === "conflict" ? props.colors.conflictTagText
                : chip.kind === "bookmark" ? props.colors.bookmarkTagText
                : props.colors.workspaceTagText}
              bg={chip.kind === "conflict" ? props.colors.conflictTagFill
                : chip.kind === "bookmark" ? props.colors.bookmarkTagFill
                : props.colors.workspaceTagFill}
            >
              {` ${chip.text} `}
            </text>
          );
        }}
      </For>
    </box>
  );
}

function ChangedFileRowContent(props: {
  state: AppStore["state"];
  rowId: string;
  row: ChangedFileDisplayRow;
  config: ResolvedAppConfig;
}) {
  const colors = props.config.colorScheme.semanticColors;

  if (props.row.kind === "placeholder") {
    return <text fg={colors.textTertiary}>{props.row.text}</text>;
  }

  const row = props.row;

  const rowState = createMemo(() =>
    getChangedFileRowState(props.state, props.rowId, row.index, row.file.path)
  );

  return (
    <box
      id={`file-row-${props.rowId}-${row.index}`}
      width="100%"
      flexDirection="row"
      gap={1}
      backgroundColor={getChangedFileRowBackgroundColor({
        focused: rowState().focused,
        selected: rowState().selected,
        colors,
      })}
    >
      <text
        flexShrink={0}
        fg={
          rowState().focused
            ? colors.fileFocusMarker
            : colors.textTertiary
        }
      >
        {rowState().marker}
      </text>
      <text
        flexShrink={0}
        fg={rowState().selected ? colors.rowSelectedAccent : colors.textTertiary}
      >
        {rowState().selected ? "✓" : " "}
      </text>
      <text flexShrink={0} fg={colors.fileStatusAccent}>{row.file.status}</text>
      <text
        flexShrink={1}
        minWidth={0}
        wrapMode="none"
        fg={rowState().selected || rowState().focused ? colors.textPrimary : colors.textSecondary}
        truncate
      >
        {row.file.path}
      </text>
      <Show when={row.file.hasConflict}>
        <text fg={colors.statusError} attributes={TextAttributes.BOLD}> conflict</text>
      </Show>
    </box>
  );
}

function ChangedFiles(props: {
  state: AppStore["state"];
  revision: RevisionSummary;
  config: ResolvedAppConfig;
}) {
  const rows = createMemo(() => buildChangedFileDisplayRows(props.revision));
  const inlineConfirmation = createMemo(() =>
    props.state.inlineConfirmation?.rowId === props.revision.rowId
      ? props.state.inlineConfirmation
      : null
  );

  return (
    <box width="100%" flexDirection="column">
      <For each={rows()}>
        {(row) => (
          <ChangedFileRowContent
            state={props.state}
            rowId={props.revision.rowId}
            row={row}
            config={props.config}
          />
        )}
      </For>
      {inlineConfirmation()
        ? (
          <InlineConfirmation
            config={props.config}
            message={inlineConfirmation()!.message}
            options={inlineConfirmation()!.options}
            selectedOption={inlineConfirmation()!.selectedOption}
          />
        )
        : null}
    </box>
  );
}

function markerColor(
  revision: RevisionSummary,
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"],
): string | undefined {
  switch (revision.marker) {
    case "working-copy":
      return colors.graphWorkingCopy;
    case "bookmark":
      return colors.graphBookmark;
    case "immutable":
      return colors.graphImmutable;
    default:
      return colors.graphPlain;
  }
}

function getRevisionRowState(
  rowId: string | null,
  focusedRowId: string | null,
  selectedRowIds: ReadonlySet<string>,
): RevisionRowState | null {
  if (rowId === null) {
    return null;
  }

  if (selectedRowIds.has(rowId)) {
    return "selected";
  }

  if (rowId === focusedRowId) {
    return "focused";
  }

  return "default";
}

function padRight(value: string, length: number): string {
  if (value.length >= length) {
    return value;
  }

  return `${value}${" ".repeat(length - value.length)}`;
}

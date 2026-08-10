import { join } from "node:path";
import { MouseButton, RGBA, StyledText, TextAttributes, type MouseEvent, type ScrollBoxRenderable, type TextChunk } from "@opentui/core";
import { For, Index, Show, createEffect, createMemo, createRenderEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useKeyboard, useRenderer } from "@opentui/solid";
import { createCommandRunner } from "../commands/runner.ts";
import type { AppConfig, ResolvedAppConfig } from "../config/schema.ts";
import { isUserDefinedBinding, resolveConfiguredKeymap } from "../config/index.ts";
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
  getFocusTone,
  getFocusedFile,
  getFocusedRevision,
  getFocusedOperationLogEntry,
  getFocusedRevisionArg,
  getMarkedRowIds,
  getDisplayedNotifications,
  getOperationAffectedRowIds,
  getVisibleExpandedFiles,
  type CommandSegment,
} from "../state/store.ts";
import { logShortcutDebug } from "../debug.ts";
import { DEFAULT_REPOSITORY_LOAD_LIMIT, type JjClient } from "../jj/client.ts";
import { JjHelpCache } from "../jj/helpCache.ts";
import { runInteractiveCommand, runInteractiveShellCommand } from "../jj/process.ts";
import { isFilesOnlyRevset } from "../revset/files.ts";
import { restartCurrentJif } from "../restart.ts";
import type { ChangedFile, RevisionSummary, StatusMessage } from "../domain/types.ts";
import { createJifCommandController, loadRevisionFiles } from "./controller.ts";
import { lazyComponent } from "./lazyComponent.ts";
import {
  effectivePreviewCols,
  effectivePreviewPosition,
  effectivePreviewRows,
} from "../domain/preview.ts";
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
import {
  buildRevisionSideChips,
  getRevisionLayoutPlan,
  resolveRevisionGraphMode,
  type RevisionSideChip,
} from "./revisionLayout.ts";
import {
  buildRevisionChangeIdSegments,
  formatRelativeAgo,
  formatRevisionPreviewHeader,
  REVISION_PREVIEW_METADATA_LINE_COUNT,
  getRevisionChangeIdDisplayLength,
  getRevisionCommandRoleColors,
  getRevisionChangeIdColors,
  getRevisionDescriptionColor,
  getRevisionSelectionMarker,
} from "./revisionHeader.ts";
import { getChangedFileRowBackgroundColor, getRevisionRowBackgroundColor } from "./rowBackgrounds.ts";
import { isScrollboxAtBottom, observeScrollboxBottomReached, scrollToKeepChildVisible, type ScrollVisibilityDirection } from "./scroll.ts";
import { buildScrollbarTrackOptions } from "./scrollbarOptions.ts";
import {
  buildAlignedShortcutGrids,
  buildShortcutEntries,
  buildShortcutGrid,
  buildShortcutPanelSectionEntries,
  buildShortcutSummary,
  buildShortcutSummarySegments,
  buildStateChipLabel,
  computeShortcutPanelHeight,
  getShortcutPanelBindings,
  resolveShortcutPanelBindings,
  shouldSplitShortcutPanelLayout,
  shortcutLayoutRowCount,
  shortcutModeLabel,
  stateChipSummaryWidth,
  type ShortcutPanelBindingInput,
  type ShortcutPanelLayout,
  type ShortcutSummarySegment,
} from "./shortcutPanel.ts";
import { resolveBottomChromeLayout, shouldShowCommandPreview } from "./bottomChrome.ts";
import { resolveKeyToken } from "./keyboard.ts";
import {
  dispatchGlobalKey,
  getShortcutFilterKeyAction,
  shouldDismissShortcutContextBeforeCommand,
  type CommandDispatchDetails,
} from "./keybindings.ts";
import {
  collectDirectCanonicalBindingsForMode,
  collectInheritedAndGlobalCanonicalBindings,
  getActiveMode,
  isFileFocusMode,
} from "../modes.ts";
import {
  buildChangedFileNameSegments,
  getChangedFileRowState,
  getChangedFilesPlaceholderText,
  showsChangedFilesFilter,
} from "./revisionFiles.ts";
import { filterChangedFiles } from "../domain/fileFilter.ts";
import { resolveOpHeadsPath } from "../jj/opHeads.ts";
import { bindAutoRefresh, bindOpHeadsWatcher, bindRefreshOnFocus, createRepositoryRefresher } from "./repositoryRefresh.ts";
import { createFocusClickGuard } from "./focusClickGuard.ts";
import { suspendProcessToShell } from "./suspend.ts";
import { openTextInEditor } from "./openTextInEditor.ts";
import { openUrl, JIF_RELEASES_URL } from "./openUrl.ts";
import { hasVisibleSearchHighlights, hasVisibleSearchScope, stripAnsi } from "../search/matching.ts";
import { getStatusHelpToastMaxBodyHeight, getStatusToastMaxBodyHeight } from "./statusMessages.ts";
import {
  bindViewRendererEvents,
  createPaletteDetector,
  estimateInitialRevisionLoadLimit,
  queuePostReadyBackgroundTask,
  queueDeferredRepositoryLoad,
  startInitialRepositoryLoad,
} from "./startup.ts";
import { executeShellCommand as executeShellTextCommand } from "../jj/process.ts";
import { makeScrollAcceleration } from "./scrollAcceleration.ts";
import { switchWorkspace } from "./workspaceSwitch.ts";
import { resolveLogSurfaceMode } from "./logSurface.ts";
import {
  createPreviewPanePresentation,
  getPreviewTargetKey,
  resolvePreviewScrollPosition,
} from "./previewRefresh.ts";
import "./scrollboxRegistration.ts";

const EXTRA_EMPTY_MESSAGE = "No extra bindings defined. Bind keys under `keymap.extra` in your config.";

// Deferred UI: these components only render for interactions that cannot
// happen on the first painted frame, so their modules stay off the startup
// critical path and are preloaded right after the UI becomes ready.
const DiffViewer = lazyComponent(() => import("./DiffViewer.tsx").then((m) => m.DiffViewer));
const PreviewPane = lazyComponent(() => import("./PreviewPane.tsx").then((m) => m.PreviewPane));
const InlineConfirmation = lazyComponent(() => import("./InlineConfirmation.tsx").then((m) => m.InlineConfirmation));
const NotificationsOverlay = lazyComponent(() => import("./NotificationsOverlay.tsx").then((m) => m.NotificationsOverlay));
const OperationLogEntryItem = lazyComponent(() => import("./OperationLogEntryItem.tsx").then((m) => m.OperationLogEntryItem));
const CommandPrompt = lazyComponent(() => import("./prompts.tsx").then((m) => m.CommandPrompt));
const CommandPreview = lazyComponent(() => import("./prompts.tsx").then((m) => m.CommandPreview));
const RevsetPrompt = lazyComponent(() => import("./prompts.tsx").then((m) => m.RevsetPrompt));
const SearchPrompt = lazyComponent(() => import("./prompts.tsx").then((m) => m.SearchPrompt));
const FileSearchPrompt = lazyComponent(() => import("./prompts.tsx").then((m) => m.FileSearchPrompt));
const SearchHighlightLayer = lazyComponent(() => import("./searchOverlay.tsx").then((m) => m.SearchHighlightLayer));

const DEFERRED_UI_COMPONENTS = [
  DiffViewer,
  PreviewPane,
  InlineConfirmation,
  NotificationsOverlay,
  OperationLogEntryItem,
  CommandPrompt,
  CommandPreview,
  RevsetPrompt,
  SearchPrompt,
  FileSearchPrompt,
  SearchHighlightLayer,
] as const;

export function JifView(props: {
  store: AppStore;
  client: JjClient;
  config: ResolvedAppConfig;
  rawConfig: AppConfig;
  reloadConfig: (projectStartDir: string) => Promise<{ raw: AppConfig; resolved: ResolvedAppConfig }>;
  refreshConfigTypes?: () => Promise<unknown>;
  onStartupError?: (error: unknown) => void;
}) {
  const { store, client } = props;
  const helpCache = new JjHelpCache(client);
  const [rawConfig, setRawConfig] = createSignal<AppConfig>(props.rawConfig);
  const [config, setConfig] = createStore<ResolvedAppConfig>(props.config);
  const [ready, setReady] = createSignal(false);
  const [currentRevisionLoadLimit, setCurrentRevisionLoadLimit] = createSignal(DEFAULT_REPOSITORY_LOAD_LIMIT);
  const [canLoadMoreRevisions, setCanLoadMoreRevisions] = createSignal(true);
  const [loadingMoreRevisions, setLoadingMoreRevisions] = createSignal(false);
  const renderer = useRenderer();
  const [terminalSize, setTerminalSize] = createSignal({
    width: Math.max(renderer.width, 1),
    height: Math.max(renderer.height, 1),
  });
  const [previewDiff, setPreviewDiff] = createSignal("");
  const [previewHeader, setPreviewHeader] = createSignal<string | null>(null);
  const [previewLoading, setPreviewLoading] = createSignal(false);
  let previewSeq = 0;
  const previewPresentation = createPreviewPanePresentation({
    getState: () => store.state,
    getConfig: () => config.preview,
    getTerminalWidth: () => terminalSize().width,
  });
  const previewFullScreen = previewPresentation.fullScreen;
  const previewShown = previewPresentation.shown;
  const previewPosition = () =>
    effectivePreviewPosition(store.state, config.preview, terminalSize().width);
  const previewCols = () =>
    effectivePreviewCols(store.state, config.preview, terminalSize().width);
  const previewRows = () =>
    effectivePreviewRows(store.state, config.preview, terminalSize().height);
  // The scrollable width inside the pane: full width below (minus scrollbar),
  // or the pane columns minus the left divider and scrollbar on the right.
  const previewViewportWidth = () =>
    previewFullScreen() || previewPosition() === "below"
      ? Math.max(1, terminalSize().width - 1)
      : Math.max(1, previewCols() - 2);
  const logScrollAcceleration = createMemo(() =>
    makeScrollAcceleration(config.scroll.step, config.scroll.acceleration)
  );
  const logSurfaceMode = createMemo(() => resolveLogSurfaceMode(store.state));
  const persistence = createPersistenceService();
  const refreshRepository = createRepositoryRefresher({
    client,
    actions: store.actions,
    getRevsetQuery: () => store.snapshot().revsetQuery,
    getRevealedCommitIds: () => store.snapshot().revealedCommitIds,
    getRefreshScope: () => store.state.repoPath,
    onRefreshSuccess: (details) => {
      setCurrentRevisionLoadLimit(details.requestedLimit);
      setCanLoadMoreRevisions(details.canLoadMore);
    },
  });
  const commandRunner = createCommandRunner({
    actions: store.actions,
    executeCommandArgs: (commandArgs, options) => client.executeCommandArgs(commandArgs, options),
    executeShellCommand: async (commandText, options) => {
      const root = options?.cwd ?? store.state.repoPath;

      return await executeShellTextCommand(root, commandText, { color: true });
    },
    executeInteractiveCommandArgs: async (commandArgs, options) => {
      const root = options?.cwd ?? store.state.repoPath;

      renderer.suspend();
      try {
        await runInteractiveCommand(root, ["jj", ...commandArgs]);
      } finally {
        renderer.resume();
      }
    },
    executeInteractiveShellCommand: async (commandText, options) => {
      const root = options?.cwd ?? store.state.repoPath;

      renderer.suspend();
      try {
        await runInteractiveShellCommand(root, commandText);
      } finally {
        renderer.resume();
      }
    },
    refreshRepository: (options) => refreshRepository(undefined, undefined, options),
  });
  const runtime = createJifRuntime({
    store,
    client,
    commandRunner,
    persistence,
    getWorkspaceRoot: () => store.state.repoPath,
    getShellCwd: () => store.state.repoPath,
    refreshRepository: (revset, options) => refreshRepository(revset, undefined, options),
  });
  const configuredKeymap = createMemo(() => resolveConfiguredKeymap(rawConfig().keymap));
  const focusClickGuard = createFocusClickGuard(renderer);
  onCleanup(() => focusClickGuard.dispose());
  let logViewport: ScrollBoxRenderable | undefined;
  let diffViewport: ScrollBoxRenderable | undefined;
  let helpViewport: ScrollBoxRenderable | undefined;
  let previewViewport: ScrollBoxRenderable | undefined;
  let renderedPreviewTargetKey: string | null = null;
  const detectAndApplyPalette = createPaletteDetector({
    renderer,
    rawConfig,
    applyResolvedConfig: (nextConfig) => {
      setConfig(reconcile(nextConfig));
    },
  });
  onCleanup(() => detectAndApplyPalette.dispose());
  const applyRuntimeConfig = async (projectStartDir: string) => {
    const next = await props.reloadConfig(projectStartDir);
    setRawConfig(next.raw);
    setConfig(reconcile(next.resolved));
    await detectAndApplyPalette();
  };
  const reloadConfig = async () => {
    await applyRuntimeConfig(store.state.repoPath);
    store.actions.pushEvent("Config reloaded.", "success");
  };
  const switchWorkspaceByName = (workspaceName: string) => switchWorkspace({
    workspaceName,
    getWorkspaceState: () => store.snapshot(),
    actions: store.actions,
    resetViewState: () => {
      previewSeq += 1;
      setPreviewHeader(null);
      setPreviewDiff("");
      setPreviewLoading(false);
      setCurrentRevisionLoadLimit(DEFAULT_REPOSITORY_LOAD_LIMIT);
      setCanLoadMoreRevisions(true);
      setLoadingMoreRevisions(false);
    },
    applyRuntimeConfig,
    loadDefaultRevset: () => client.loadDefaultRevset({ workingCopy: "read-only" }),
    loadActiveRevset: (rootPath) => persistence.loadActiveRevset(rootPath),
    refreshRepository,
  });

  onMount(() => {
    void (async () => {
      const initialRevisionLimit = initialRevisionLoadLimit();
      const initialLoad = await startInitialRepositoryLoad({
        initialRevisionLimit,
        detectAndApplyPalette,
        loadWorkspaceRoot: () => client.loadWorkspaceRoot({ workingCopy: "read-only" }).catch(() => null),
        loadDefaultRevset: () => client.loadDefaultRevset({ workingCopy: "read-only" }),
        loadSavedRevset: (resolvedWorkspaceRoot) => persistence.loadActiveRevset(resolvedWorkspaceRoot),
        refreshRepository,
        setWorkspaceRoot: (workspaceRoot) => {
          if (workspaceRoot) {
            store.actions.activateWorkspace(workspaceRoot);
          }
        },
        setRevsetQuery: (query) => {
          store.actions.setRevsetQuery(query);
        },
        focusWorkingCopy: () => {
          store.actions.focusWorkingCopy();
        },
      });
      setReady(true);
      queuePostReadyBackgroundTask({
        task: () => Promise.all(DEFERRED_UI_COMPONENTS.map((component) => component.preload())),
      });
      queuePostReadyBackgroundTask({
        task: props.refreshConfigTypes,
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          store.actions.pushEvent(`Could not refresh jif.d.ts: ${message}`, "warning");
        },
      });
      const disposeFocusRefresh = bindRefreshOnFocus(
        renderer,
        (options) => refreshRepository(undefined, undefined, options),
      );
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
    })().catch((error) => {
      renderer.destroy();
      props.onStartupError?.(error);
    });

    const disposeRendererEvents = bindViewRendererEvents({
      renderer,
      detectAndApplyPalette,
      setTerminalSize,
    });
    onCleanup(() => disposeRendererEvents());
  });

  createEffect(() => {
    if (!ready()) {
      return;
    }

    const disposeAutoRefresh = bindAutoRefresh({
      intervalMs: config.refresh.intervalMs,
      refreshRepository: (options) => refreshRepository(undefined, undefined, options),
    });
    onCleanup(() => disposeAutoRefresh());
  });

  createEffect(() => {
    if (!ready()) {
      return;
    }

    const root = store.state.repoPath;
    if (!root || !config.refresh.watch) {
      return;
    }

    let disposed = false;
    let disposeWatcher: (() => void) | null = null;
    void resolveOpHeadsPath(root).then((opHeadsPath) => {
      if (!opHeadsPath || disposed) {
        return;
      }
      disposeWatcher = bindOpHeadsWatcher({
        opHeadsPath,
        refreshRepository: (options) => refreshRepository(undefined, undefined, options),
      });
    });
    onCleanup(() => {
      disposed = true;
      disposeWatcher?.();
    });
  });

  const controller = createJifCommandController({
    store,
    client,
    destroy: () => renderer.destroy(),
    restart: () => restartCurrentJif({ destroy: () => renderer.destroy() }),
    suspend: () => suspendProcessToShell({ renderer }),
    executeCurrentCommand: runtime.executeCurrentCommand,
    runJjCommand: runtime.runJjCommand,
    runShellCommand: runtime.runShellCommand,
    runInteractiveJjCommand: runtime.runInteractiveJjCommand,
    runInteractiveShellCommand: runtime.runInteractiveShellCommand,
    applyRevsetQuery: runtime.applyRevsetQuery,
    restoreLogRevsetFromFileFilter: runtime.restoreLogRevsetFromFileFilter,
    switchWorkspace: switchWorkspaceByName,
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
    openReleasesPage: () => openUrl({ url: JIF_RELEASES_URL }),
    reloadConfig,
    refreshRepository: (options) => refreshRepository(undefined, undefined, options),
    expandElidedRevisions: runtime.expandElidedRevisions,
    persistLayout: (layout) => persistence.saveLayoutPreference(layout),
    getDiffViewport: () => diffViewport,
    getHelpViewport: () => helpViewport,
    getPreviewViewport: () => previewViewport,
    getTerminalSize: () => terminalSize(),
    getPreviewConfig: () => config.preview,
    logShortcutPanelToggle: ({ before, after, focusMode }) => {
      logShortcutDebug("toggle-shortcut-panel", {
        before,
        after,
        focusMode,
      });
    },
  });

  // Keep the preview pane's content in sync with whatever is focused. Debounced
  // so rapid j/k navigation doesn't spawn a jj process per keystroke; a sequence
  // token discards stale async results.
  createEffect(() => {
    const mode = logSurfaceMode();
    const visible = previewShown();
    const activeRoot = store.state.repoPath;
    const targetKey = getPreviewTargetKey(store.state, mode);
    const seq = ++previewSeq;

    // A pinned diff was fetched by whoever composed it, so it stands in for the
    // focus-derived content until Preview mode ends.
    const pin = store.state.previewPin;
    if (pin) {
      setPreviewHeader(pin.header);
      setPreviewDiff(pin.diff);
      setPreviewLoading(false);
      previewViewport?.scrollTo({ x: 0, y: 0 });
      return;
    }

    if (
      !visible ||
      (mode !== "revisions" && mode !== "files" && mode !== "op-log" && mode !== "evolog")
    ) {
      renderedPreviewTargetKey = null;
      setPreviewHeader(null);
      setPreviewDiff("");
      setPreviewLoading(false);
      return;
    }

    let fetcher: (() => Promise<{ diff: string; header: string | null }>) | null = null;
    // Shown immediately (from state) while the async fetch runs.
    let placeholderHeader: string | null = null;

    if (mode === "revisions") {
      const revision = getFocusedRevision(store.state);
      const revArg = getFocusedRevisionArg(store.state);
      if (revision && revArg) {
        fetcher = async () => {
          const [diff, metadata] = await Promise.all([
            client.loadRevisionDiff(revArg),
            client.loadRevisionPreviewMetadata(revArg),
          ]);
          return {
            diff,
            header: formatRevisionPreviewHeader(metadata, revision.description),
          };
        };
      }
    } else if (mode === "files") {
      const revArg = getFocusedRevisionArg(store.state);
      const file = getFocusedFile(store.state);
      if (revArg && file) {
        const absolutePath = join(store.state.repoPath, file.path);
        const fullFile = store.state.previewFullFile;
        fetcher = async () => ({
          diff: await client.loadFileDiff(revArg, absolutePath, { fullFile }),
          header: null,
        });
      }
    } else if (mode === "op-log") {
      const entry = getFocusedOperationLogEntry(store.state);
      if (entry) {
        placeholderHeader = stripAnsi(entry.lines[0] ?? "").trim() || entry.id;
        const header = placeholderHeader;
        fetcher = async () => ({ diff: await client.loadOperationDiffGit(entry.id), header });
      }
    } else {
      const entry = store.state.evologEntries[store.state.focusedEvologIndex];
      const commitId = entry?.commitId;
      if (entry && commitId) {
        placeholderHeader = stripAnsi(entry.lines[0] ?? "").trim() || commitId;
        const header = placeholderHeader;
        fetcher = async () => ({ diff: await client.loadEvologEntryDiff(commitId), header });
      }
    }

    setPreviewHeader(placeholderHeader);

    if (!fetcher) {
      // A rewritten revision temporarily has no loaded files. Keep showing the
      // same logical file preview until its refreshed file list arrives; this
      // also prevents the scrollbox from clamping its position against an
      // empty payload in the meantime.
      if (mode === "files" && targetKey !== null && targetKey === renderedPreviewTargetKey) {
        setPreviewLoading(true);
        return;
      }

      renderedPreviewTargetKey = null;
      setPreviewDiff("");
      setPreviewLoading(false);
      return;
    }

    const runFetch = fetcher;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      void (async () => {
        try {
          const result = await runFetch();
          if (seq === previewSeq && store.state.repoPath === activeRoot) {
            const scrollPosition = resolvePreviewScrollPosition(
              renderedPreviewTargetKey,
              targetKey,
              previewViewport,
            );
            setPreviewDiff(result.diff);
            setPreviewHeader(result.header);
            renderedPreviewTargetKey = targetKey;
            previewViewport?.scrollTo(scrollPosition);
          }
        } catch (error) {
          if (seq === previewSeq && store.state.repoPath === activeRoot) {
            setPreviewDiff("");
            store.actions.reportError(error);
          }
        } finally {
          if (seq === previewSeq && store.state.repoPath === activeRoot) {
            setPreviewLoading(false);
          }
        }
      })();
    }, 50);
    onCleanup(() => clearTimeout(timer));
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
  const directModeBindings = createMemo(() =>
    resolveShortcutPanelBindings(
      collectDirectCanonicalBindingsForMode(activeMode(), configuredKeymap().keymap),
      commandsById(),
    )
  );
  const inheritedAndGlobalBindings = createMemo(() =>
    resolveShortcutPanelBindings(
      collectInheritedAndGlobalCanonicalBindings(activeMode(), configuredKeymap().keymap),
      commandsById(),
    )
  );
  const modeShortcutBindings = createMemo(() =>
    getShortcutPanelBindings(store.state, directModeBindings())
  );
  const shortcutInheritedBindings = createMemo(() =>
    getShortcutPanelBindings(store.state, inheritedAndGlobalBindings())
  );
  // `collectCanonicalBindingsForMode` is direct-then-inherited and every panel
  // filter is per-binding, so concatenating the two halves avoids filtering the
  // inherited bindings a second time on every focus move.
  const shortcutBindings = createMemo(() => [
    ...modeShortcutBindings(),
    ...shortcutInheritedBindings(),
  ]);
  const shortcutEntries = createMemo(() =>
    buildShortcutEntries(shortcutBindings(), store.state.shortcutFilterQuery)
  );
  const shortcutContentWidth = createMemo(() => Math.max(1, terminalSize().width - 4));
  const isFileFilterRevset = createMemo(() => isFilesOnlyRevset(store.state.revsetQuery));
  const stateChipLabel = createMemo(() =>
    buildStateChipLabel(isFileFilterRevset(), store.state.dryRun)
  );
  const shortcutSummarySegments = createMemo(() => {
    const chipLabel = stateChipLabel();
    if (chipLabel === null) {
      return buildShortcutSummarySegments(shortcutEntries(), shortcutContentWidth());
    }
    // Persistent state chips share the status row with shortcut hints. Budget
    // for their exact combined label so trailing hints drop before overflowing.
    const availableWidth = shortcutContentWidth() - stateChipSummaryWidth(chipLabel);
    const leadingEntries = isFileFilterRevset()
      ? [{ keyLabel: "esc", label: "log" }]
      : [];
    return buildShortcutSummarySegments(shortcutEntries(), availableWidth, leadingEntries);
  });
  const shortcutSummary = createMemo(() =>
    buildShortcutSummary(shortcutEntries(), shortcutContentWidth())
  );
  const shortcutGrid = createMemo(() =>
    buildShortcutGrid(shortcutEntries(), shortcutContentWidth())
  );
  const shortcutLayout = createMemo<ShortcutPanelLayout>(() => ({
    sections: [shortcutGrid()],
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
  const showsPromptSurface = createMemo(() =>
    showsCommandPrompt() || showsRevsetPrompt() || showsFileSearchPrompt() || showsSearchPrompt()
  );
  const showsPersistentShortcutPanel = createMemo(() =>
    !showsCommandPrompt() && !showsRevsetPrompt() && !showsFileSearchPrompt() && !showsSearchPrompt() &&
    store.state.shortcutPanelExpanded
  );
  const showsCommandPreview = createMemo(() =>
    shouldShowCommandPreview({
      showsPromptSurface: showsPromptSurface(),
      showsPersistentShortcutPanel: showsPersistentShortcutPanel(),
      hasCommandSegments: commandSegments() !== null,
      hasCommandDraft: store.state.commandDraft !== null,
    })
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
      store.state.focusMode === "preview" ||
      (modeShortcutBindings().length > 0 &&
        (showsCommandPreview() || store.state.focusMode === "bookmark"))
    )
  );
  const splitsInheritedShortcuts = createMemo(() =>
    store.state.shortcutFilterQuery.trim() === "" &&
    shouldSplitShortcutPanelLayout({
      showsPersistentShortcutPanel: showsPersistentShortcutPanel(),
      showsTransientShortcutPanel: showsTransientShortcutPanel(),
      hasCommandDraft: store.state.commandDraft !== null,
      activeMode: activeMode(),
    })
  );
  // A transient panel narrows to the mode's own bindings unless it is already
  // splitting them out from the inherited ones.
  const expandedInheritedBindings = createMemo(() =>
    showsTransientShortcutPanel() && !splitsInheritedShortcuts()
      ? []
      : shortcutInheritedBindings()
  );
  const isUserDefinedShortcut = createMemo(() => {
    const { userBindings } = configuredKeymap();
    return (binding: ShortcutPanelBindingInput) => isUserDefinedBinding(userBindings, binding);
  });
  const expandedShortcutLayout = createMemo<ShortcutPanelLayout>(() => ({
    sections: buildAlignedShortcutGrids(
      buildShortcutPanelSectionEntries({
        directBindings: modeShortcutBindings(),
        inheritedBindings: expandedInheritedBindings(),
        isUserDefined: isUserDefinedShortcut(),
        splitInheritedBindings: splitsInheritedShortcuts(),
        query: store.state.shortcutFilterQuery,
      }),
      shortcutContentWidth(),
    ),
  }));
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

    const shortcutFilterAction = getShortcutFilterKeyAction(
      normalizedKey,
      state,
      configuredKeymap().keymap,
      bottomChromeLayout().showExpandedShortcutPanel,
    );
    if (shortcutFilterAction === "activate") {
      controller.openShortcutFilter();
      event.preventDefault();
      return;
    }
    if (shortcutFilterAction === "cancel") {
      store.actions.cancelOrBlur();
      event.preventDefault();
      return;
    }
    if (shortcutFilterAction === "input") {
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
  let prevRevisionScrollRequest = store.state.revisionScrollRequest;
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
    const revisionScrollRequest = store.state.revisionScrollRequest;
    const explicitScrollRequest = revisionScrollRequest !== prevRevisionScrollRequest;
    const direction: ScrollVisibilityDirection = explicitScrollRequest && focusedIndex === prevFocusedIndex
      ? "nearest"
      : focusedIndex >= prevFocusedIndex ? "down" : "up";
    prevRevisionScrollRequest = revisionScrollRequest;
    prevFocusedIndex = focusedIndex;

    const marginRowId = (() => {
      if (direction === "nearest") {
        return focusedRevision.rowId;
      }

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
    if (!isFileFocusMode(store.state.focusMode) || !logViewport) {
      return;
    }

    const expandedId = store.state.expandedRowId;
    if (!expandedId) {
      return;
    }

    const fileCount = getVisibleExpandedFiles(store.state).length;
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
      await refreshRepository(undefined, nextLimit, { workingCopy: "read-only" });
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
        <box
          flexGrow={1}
          width="100%"
          minHeight={0}
          flexDirection={previewPosition() === "below" ? "column" : "row"}
        >
          {/*
            Hidden rather than unmounted during the full-screen takeover:
            `visible={false}` sets Yoga `display: none`, so the column costs no
            layout space, but every revision row — and the scrollbox's position
            — survives, making the takeover cheap to dismiss.
          */}
          <box visible={!previewFullScreen()} flexGrow={1} minWidth={0} minHeight={0}>
        <Show
          when={store.state.focusMode === "diff-viewer" && store.state.diffViewer}
          fallback={(
            <scrollbox
              ref={logViewport}
              width="100%"
              flexGrow={1}
              scrollY
              scrollAcceleration={logScrollAcceleration()}
              scrollbarOptions={buildScrollbarTrackOptions(
                config.colorScheme.semanticColors.chromeFillThree,
                config.colorScheme.semanticColors.chromeScrollbarThumb,
              )}
            >
              <box width="100%" flexDirection="column">
                <RevisionLogSurface
                  visible={logSurfaceMode() === "revisions" || logSurfaceMode() === "files"}
                  fileFilterActions={store.actions}
                  state={store.state}
                  config={config}
                  revisionChangeIdDisplayLength={revisionChangeIdDisplayLength()}
                  onMouseFocus={(index) => {
                    if (focusClickGuard.isWithinFocusGrace()) return;
                    store.actions.focusRevisionAt(index);
                  }}
                />
                <Show when={logSurfaceMode() === "evolog"}>
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
                <Show when={logSurfaceMode() === "op-log"}>
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
                <Show when={logSurfaceMode() === "notifications"}>
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
          </box>
          <Show when={previewShown()}>
            <box
              flexShrink={0}
              flexGrow={previewFullScreen() ? 1 : 0}
              width={previewFullScreen() || previewPosition() === "below" ? "100%" : previewCols()}
              height={previewFullScreen() || previewPosition() !== "below" ? "100%" : previewRows()}
              border={previewFullScreen() ? [] : previewPosition() === "below" ? ["top"] : ["left"]}
              borderStyle="single"
              borderColor={config.colorScheme.semanticColors.chromeBorderIdle}
              backgroundColor={config.colorScheme.semanticColors.previewPaneFill}
            >
              <PreviewPane
                header={previewHeader()}
                headerDividerAfterLine={
                  store.state.previewPin === null && logSurfaceMode() === "revisions"
                    ? REVISION_PREVIEW_METADATA_LINE_COUNT
                    : null
                }
                diff={previewDiff()}
                loading={previewLoading()}
                viewportWidth={previewViewportWidth()}
                config={config}
                previewWordWrap={store.state.previewWordWrap}
                registerScrollbox={(el) => {
                  previewViewport = el;
                }}
              />
            </box>
          </Show>
        </box>
        <Show when={bottomChromeLayout().showExpandedShortcutPanel}>
          <StatusArea
            shortcutSummary={shortcutSummary()}
            shortcutSummarySegments={shortcutSummarySegments()}
            shortcutLayout={expandedShortcutLayout()}
            expanded
            currentModeLabel={shortcutModeLabel(activeMode())}
            panelBodyHeight={expandedShortcutPanelBodyHeight()}
            actionLabel={showsPersistentShortcutPanel() ? "? filter" : null}
            stateChipLabel={stateChipLabel()}
            config={config}
            loadingIndicatorText={loadingIndicatorText()}
            emptyMessage={activeMode() === "extra" ? EXTRA_EMPTY_MESSAGE : undefined}
            shortcutFilterQuery={store.state.shortcutFilterQuery}
            shortcutFilterEditing={store.state.focusMode === "shortcut-filter"}
            onShortcutFilterInput={store.actions.setShortcutFilterQuery}
            onShortcutFilterApply={store.actions.applyShortcutFilter}
          />
        </Show>
        <Show when={showsCommandPrompt()}>
          <CommandPrompt
            store={store}
            config={config}
            client={client}
            helpCache={helpCache}
            composeEnabled={store.state.commandBar.kind === "jj"}
            workspaceRoot={store.state.repoPath}
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
            workspaceRoot={store.state.repoPath}
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
            searchMode={store.state.searchMode}
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
            stateChipLabel={stateChipLabel()}
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

export function RevisionLogSurface(props: {
  visible: boolean;
  fileFilterActions: FileFilterActions;
  state: AppStore["state"];
  config: ResolvedAppConfig;
  revisionChangeIdDisplayLength?: number;
  onMouseFocus?: (index: number) => void;
}) {
  const focusedRowId = createMemo(() => getFocusedRevision(props.state)?.rowId ?? null);
  const selectedRowIds = createMemo(() => getMarkedRowIds(props.state));
  const expandedRowId = createMemo(() => getExpandedRevision(props.state)?.rowId ?? null);
  const commandTargetRowId = createMemo(() => getCommandTargetRowId(props.state));

  return (
    <box
      id="revision-log-surface"
      visible={props.visible}
      width="100%"
      flexDirection="column"
    >
      <For each={props.state.revisions}>
        {(revision, index) => (
          <RevisionItem
            fileFilterActions={props.fileFilterActions}
            state={props.state}
            revision={revision}
            revisionChangeIdDisplayLength={props.revisionChangeIdDisplayLength}
            index={index()}
            previousRowId={props.state.revisions[index() - 1]?.rowId ?? null}
            nextRowId={props.state.revisions[index() + 1]?.rowId ?? null}
            config={props.config}
            focusedRowId={focusedRowId()}
            selectedRowIds={selectedRowIds()}
            expandedRowId={expandedRowId()}
            commandTargetRowId={commandTargetRowId()}
            onMouseFocus={() => props.onMouseFocus?.(index())}
          />
        )}
      </For>
    </box>
  );
}

export function RevisionItem(props: {
  fileFilterActions: FileFilterActions;
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
  const changedFileRows = createMemo(() =>
    isExpanded() ? buildChangedFileDisplayRows(props.revision, props.state.fileFilterQuery) : []
  );
  const showsFileFilter = createMemo(() => isExpanded() && showsChangedFilesFilter(props.state));
  const rowState = createMemo(() =>
    getRevisionRowState(props.revision.rowId, props.focusedRowId, props.selectedRowIds) ?? "default",
  );
  const previousRowState = createMemo(() =>
    getRevisionRowState(props.previousRowId, props.focusedRowId, props.selectedRowIds),
  );
  const nextRowState = createMemo(() =>
    getRevisionRowState(props.nextRowId, props.focusedRowId, props.selectedRowIds),
  );
  // Every row the expanded detail area draws below the header: the filter
  // input, the (filtered) file rows or their placeholder, and any inline
  // confirmation. The graph gutter is extended to cover exactly these.
  const detailRowCount = () => isExpanded()
    ? changedFileRows().length + (showsFileFilter() ? 1 : 0) + (inlineConfirmation() ? 1 : 0)
    : 0;
  const sideChips = createMemo(() => buildRevisionSideChips(props.revision));
  const layoutPlan = createMemo(() => getRevisionLayoutPlan(props.state.layout));
  const visibleGraphMode = createMemo(() =>
    resolveRevisionGraphMode(layoutPlan(), props.revision.graphRows)
  );
  const boxedGraphWidth = createMemo(() =>
    measureBoxedGraphWidth({
      graphRows: props.revision.graphRows,
      baseGraphRowCount: layoutPlan().graph.baseRowCount,
      visibleGraphMode: visibleGraphMode(),
    })
  );
  const previousBoxedGraphWidth = createMemo(() => {
    const prev = props.index > 0 ? props.state.revisions[props.index - 1] : null;
    if (!prev) {
      return null;
    }

    return measureBoxedGraphWidth({
      graphRows: prev.graphRows,
      baseGraphRowCount: layoutPlan().graph.baseRowCount,
      visibleGraphMode: resolveRevisionGraphMode(layoutPlan(), prev.graphRows),
    });
  });
  const nextBoxedGraphWidth = createMemo(() => {
    const next = props.state.revisions[props.index + 1] ?? null;
    if (!next) {
      return null;
    }

    return measureBoxedGraphWidth({
      graphRows: next.graphRows,
      baseGraphRowCount: layoutPlan().graph.baseRowCount,
      visibleGraphMode: resolveRevisionGraphMode(layoutPlan(), next.graphRows),
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
    visibleGraphMode() === "keep-second-row"
  );
  const previousUsesExternalGraphSpacer = createMemo(() => {
    const previous = props.index > 0 ? props.state.revisions[props.index - 1] : null;
    if (!previous) {
      return false;
    }

    return resolveRevisionGraphMode(layoutPlan(), previous.graphRows) === "keep-second-row";
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
    baseGraphRowCount: layoutPlan().graph.baseRowCount,
    visibleGraphMode: visibleGraphMode(),
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
  const isPinnedTarget = createMemo(() =>
    (props.state.commandDraft?.rebaseTargetRowIds ?? []).includes(props.revision.rowId)
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
  // A row carrying a command chip takes its chip color, row fill, and border
  // as one inseparable triple, so the background is always the dim version of
  // the chip. The muted absorb "default" reminder is the one chip without a
  // role; it keeps its chrome styling below.
  const commandRoleColors = createMemo(() =>
    commandChipText() === null || isAbsorbDefaultDeselected()
      ? null
      : getRevisionCommandRoleColors({
        rowState: isCommandSource() ? "selected" : effectiveRowState(),
        pinnedTarget: isPinnedTarget(),
        colors: colors(),
      })
  );
  const focusTone = createMemo(() => getFocusTone(props.state));
  // Focus tone styles only chip-less focused rows; a chip-bearing row keeps
  // its role colors under the cursor.
  const focusFillColor = createMemo(() => {
    switch (focusTone()) {
      case "browse":
        return props.state.focusMode === "files" && isExpanded()
          ? colors().fileGroupFocusedFill
          : props.config.colorScheme.rowFocusedFillByLayout[props.state.layout];
      case "draft": return colors().rowDraftFocusedFill;
      case "target": return colors().rowPinnedTargetFill;
    }
  });
  const focusBorderColor = createMemo(() => {
    switch (focusTone()) {
      case "browse": return colors().rowBorderFocus;
      case "draft": return colors().rowBorderDraftFocus;
      case "target": return colors().rowBorderPinnedTarget;
    }
  });
  const borderColor = createMemo(() =>
    rowState() === "selected"
      ? colors().rowBorderSelected
      : rowState() === "focused"
        ? (commandRoleColors()?.border ?? focusBorderColor())
        : isCommandTarget()
        ? colors().rowBorderCommandTarget
        : (commandRoleColors()?.border ?? colors().rowBorderIdle)
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
      commandRoleFill: commandRoleColors()?.rowFill,
      affected: isAffected(),
      colors: { ...colors(), rowFocusedFill: focusFillColor() },
    })
  );
  const commandChipBackgroundColor = createMemo(() =>
    isAbsorbDefaultDeselected()
      ? colors().chromeFillThree
      : commandRoleColors()?.chipBg
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
    baseGraphRowCount: layoutPlan().graph.baseRowCount,
    visibleGraphMode: visibleGraphMode(),
    detailRowCount: detailRowCount(),
    ownsTop: false,
    ownsBottom: false,
    previousGraphBottom: null,
    hasNextRevision: false,
  }));
  const superGraphWidth = createMemo(() => measureGutterPlanWidth(superGutterPlan()));
  const isBoxedLayout = () => layoutPlan().contentFrame === "bordered";
  const activeGutterPlan = () => isBoxedLayout() ? gutterPlan() : superGutterPlan();
  const activeGraphWidth = () => isBoxedLayout() ? inlineGraphWidth() : superGraphWidth();
  const activeGraphTail = () => isBoxedLayout() ? inlineGraphTail() : superGutterPlan().tail;
  const activeGraphDetail = () => activeGutterPlan().detail;
  const effectiveHeaderRowCount = () =>
    props.revision.marker === "elided" ? 1 : layoutPlan().header.rowCount;
  const descriptionSlotLayout = () => layoutPlan().header.slots.description;
  const commandSlotLayout = () => layoutPlan().header.slots.command;
  const showsTopNarrowConnector = () =>
    isBoxedLayout() &&
    borderPolicy().ownsTop &&
    connectedPrevLeftCol() !== null &&
    currentLeftCol() < connectedPrevLeftCol()!;
  const showsTopWideConnector = () =>
    isBoxedLayout() &&
    borderPolicy().ownsTop &&
    connectedPrevLeftCol() !== null &&
    currentLeftCol() > connectedPrevLeftCol()!;
  const showsBottomNarrowConnector = () =>
    isBoxedLayout() &&
    borderPolicy().ownsBottom &&
    connectedNextLeftCol() !== null &&
    currentLeftCol() < connectedNextLeftCol()!;
  const showsBottomWideConnector = () =>
    isBoxedLayout() &&
    borderPolicy().ownsBottom &&
    connectedNextLeftCol() !== null &&
    currentLeftCol() > connectedNextLeftCol()!;

  return (
    <box
      id={`revision-${props.revision.rowId}`}
      width="100%"
      flexDirection="column"
      backgroundColor={rowBackgroundColor()}
      opacity={anyExpanded() && !isExpanded() ? 0.6 : 1}
      onMouseDown={(event: MouseEvent) => {
        if (event.button !== MouseButton.LEFT) return;
        props.onMouseFocus?.();
      }}
    >
      <box
        id={`revision-frame-${props.revision.rowId}`}
        width="100%"
        flexDirection="column"
      >
        <box width="100%" flexDirection="row" position="relative">
          <box
            id={`revision-slot-graph-${props.revision.rowId}`}
            width={activeGraphWidth()}
            flexDirection="column"
          >
            <box
              id={`revision-slot-graph-top-${props.revision.rowId}`}
              visible={isBoxedLayout() && gutterPlan().topDivider !== null}
              width="100%"
              height={1}
              flexDirection="row"
            >
              <text fg={continuationGraphColor()}>
                {padRight(gutterPlan().topDivider ?? "", activeGraphWidth())}
              </text>
            </box>
            <box
              id={`revision-slot-graph-title-${props.revision.rowId}`}
              flexDirection="row"
              height={1}
            >
              <Index each={splitGraphTitleSegments(padRight(activeGutterPlan().title, activeGraphWidth()))}>
                {(segment) => (
                  <text
                    fg={segment().isMarker && props.revision.hasConflict ? colors().statusError : titleGraphColor()}
                    attributes={segment().isMarker && props.revision.hasConflict ? TextAttributes.BOLD : undefined}
                  >
                    {segment().text}
                  </text>
                )}
              </Index>
            </box>
            <box
              id={`revision-slot-graph-subtitle-${props.revision.rowId}`}
              visible={
                isBoxedLayout() &&
                layoutPlan().header.rowCount === 2 &&
                props.revision.marker !== "elided"
              }
              width="100%"
              height={1}
              flexDirection="row"
            >
              <text fg={continuationGraphColor()}>
                {padRight(gutterPlan().subtitle, activeGraphWidth())}
              </text>
            </box>
            <Index each={activeGraphTail()}>
              {(graphLine) => (
                <text fg={continuationGraphColor()}>
                  {padRight(graphLine(), activeGraphWidth())}
                </text>
              )}
            </Index>
            <Index each={activeGraphDetail()}>
              {(graphLine) => (
                <text fg={continuationGraphColor()}>
                  {padRight(graphLine(), activeGraphWidth())}
                </text>
              )}
            </Index>
            <box
              id={`revision-slot-graph-bottom-${props.revision.rowId}`}
              visible={isBoxedLayout() && inlineBottomDivider() !== null}
              width="100%"
              height={1}
              flexDirection="row"
            >
              <text fg={continuationGraphColor()}>
                {padRight(inlineBottomDivider() ?? "", activeGraphWidth())}
              </text>
            </box>
          </box>
          <box width={1} />
          <box
            id={`revision-slot-content-frame-${props.revision.rowId}`}
            flexGrow={1}
            flexDirection="column"
            backgroundColor={rowBackgroundColor()}
            border={isBoxedLayout() ? borderPolicy().borderSides : []}
            borderStyle="single"
            borderColor={borderColor()}
            customBorderChars={isBoxedLayout() ? borderPolicy().borderChars : undefined}
          >
            <box
              id={`revision-slot-header-${props.revision.rowId}`}
              width="100%"
              height={effectiveHeaderRowCount()}
              flexDirection="column"
              position="relative"
              overflow="hidden"
            >
              <box
                visible={props.revision.marker !== "elided"}
                width="100%"
                height={layoutPlan().header.rowCount}
                flexDirection="row"
                position="relative"
                overflow="hidden"
              >
                <box
                  id={`revision-slot-identity-${props.revision.rowId}`}
                  flexDirection="row"
                  flexShrink={0}
                >
                  <box id={`revision-slot-change-id-${props.revision.rowId}`} flexDirection="row" flexShrink={0}>
                    <RevisionChangeId
                      revision={props.revision}
                      displayLength={revisionChangeIdDisplayLength()}
                      rowState={effectiveRowState()}
                      colors={colors()}
                    />
                  </box>
                  <box id={`revision-slot-selection-${props.revision.rowId}`} flexDirection="row" flexShrink={0}>
                    <text flexShrink={0} fg={colors().rowSelectedAccent} attributes={TextAttributes.BOLD}>
                      {getRevisionSelectionMarker(effectiveRowState())}
                    </text>
                  </box>
                </box>
                {/*
                  The chips ride the identity row in every layout, so a wide
                  bookmark set has to be clipped here rather than pushing the
                  date and command chips off the right edge. That is what
                  `flexShrink` buys, and it is why this box must not take a
                  numeric `height`: opentui's height setter resets `flexShrink`
                  to 0 whenever it is 1, which would restore the pushing.
                */}
                <box
                  id={`revision-slot-side-chips-${props.revision.rowId}`}
                  flexDirection="row"
                  overflow="hidden"
                  minWidth={0}
                  flexShrink={1}
                >
                  <RevisionSideChips
                    chips={sideChips()}
                    colors={colors()}
                    bookmarkLabelMaxLength={
                      props.config.log.bookmarkLabelMaxLength[props.state.layout]
                    }
                    workspaceLabelMaxLength={
                      props.config.log.workspaceLabelMaxLength[props.state.layout]
                    }
                  />
                </box>
                <box visible={sideChips().length > 0} width={1} />
                <box
                  id={`revision-slot-description-${props.revision.rowId}`}
                  position={descriptionSlotLayout().placement === "positioned" ? "absolute" : "relative"}
                  left={descriptionSlotLayout().placement === "positioned" ? 0 : undefined}
                  right={descriptionSlotLayout().placement === "positioned" ? 0 : undefined}
                  top={descriptionSlotLayout().row}
                  flexGrow={descriptionSlotLayout().placement === "flow" && descriptionSlotLayout().grow ? 1 : 0}
                  flexBasis={descriptionSlotLayout().placement === "flow" && descriptionSlotLayout().grow ? 0 : undefined}
                  minWidth={0}
                  height={1}
                  overflow="hidden"
                  flexDirection="row"
                >
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
                <box
                  visible={descriptionSlotLayout().placement === "positioned"}
                  flexGrow={1}
                  height={1}
                />
                <box visible={!isBoxedLayout()} width={1} height={1} />
                <box
                  id={`revision-slot-date-${props.revision.rowId}`}
                  flexDirection="row"
                  flexShrink={0}
                >
                  <DateChip text={relativeAgo()} colors={colors()} />
                </box>
                <box
                  id={`revision-slot-command-${props.revision.rowId}`}
                  visible={commandChipText() !== null}
                  position={commandSlotLayout().placement === "positioned" ? "absolute" : "relative"}
                  right={commandSlotLayout().placement === "positioned" ? 0 : undefined}
                  top={commandSlotLayout().row}
                  zIndex={commandSlotLayout().placement === "positioned" ? 50 : 0}
                  flexDirection="row"
                  flexShrink={0}
                >
                  <CommandChip
                    text={commandChipText() ?? ""}
                    backgroundColor={commandChipBackgroundColor()}
                    foregroundColor={commandChipForegroundColor()}
                    colors={colors()}
                  />
                </box>
              </box>
              <text
                visible={props.revision.marker === "elided"}
                width="100%"
                fg={colors().textTertiary}
                wrapMode="none"
                truncate={true}
              >
                {props.revision.description}
              </text>
            </box>
            <Index each={activeGraphTail()}>
              {() => <box width="100%" height={1} />}
            </Index>
            <box
              id={`revision-slot-details-${props.revision.rowId}`}
              visible={props.revision.marker !== "elided" && isExpanded()}
              width="100%"
              flexDirection="column"
            >
              {isExpanded() ? (
                <ChangedFiles
                  fileFilterActions={props.fileFilterActions}
                  state={props.state}
                  revision={props.revision}
                  rows={changedFileRows()}
                  config={props.config}
                />
              ) : null}
            </box>
          </box>
          <text
            visible={showsTopNarrowConnector()}
            position="absolute"
            left={showsTopNarrowConnector() ? connectedPrevLeftCol()! : 0}
            top={0}
            zIndex={1}
            fg={borderColor()}
          >
            ┴
          </text>
          <text
            visible={showsTopWideConnector()}
            position="absolute"
            left={showsTopWideConnector() ? connectedPrevLeftCol()! : 0}
            top={0}
            zIndex={1}
            fg={borderColor()}
          >
            {showsTopWideConnector()
              ? "└" + "─".repeat(currentLeftCol() - connectedPrevLeftCol()! - 1)
              : ""}
          </text>
          <text
            visible={showsBottomNarrowConnector()}
            position="absolute"
            left={showsBottomNarrowConnector() ? connectedNextLeftCol()! : 0}
            bottom={0}
            zIndex={1}
            fg={borderColor()}
          >
            ┬
          </text>
          <text
            visible={showsBottomWideConnector()}
            position="absolute"
            left={showsBottomWideConnector() ? connectedNextLeftCol()! : 0}
            bottom={0}
            zIndex={1}
            fg={borderColor()}
          >
            {showsBottomWideConnector()
              ? "┌" + "─".repeat(currentLeftCol() - connectedNextLeftCol()! - 1)
              : ""}
          </text>
        </box>
        <box
          id={`revision-slot-graph-external-${props.revision.rowId}`}
          visible={isBoxedLayout() && usesExternalGraphSpacer()}
          width="100%"
          flexDirection="column"
        >
          <Index each={isBoxedLayout() ? externalGraphRows() : []}>
            {(graphLine) => (
              <box width="100%" flexDirection="row">
                <text fg={continuationGraphColor()}>
                  {padRight(graphLine(), fullGraphWidth())}
                </text>
                <box width={1} />
                <box flexGrow={1} height={1} />
              </box>
            )}
          </Index>
        </box>
      </box>
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

type FileFilterActions = Pick<
  AppStore["actions"],
  "finalizeFileFilter" | "setFileFilterText"
>;

function buildChangedFileDisplayRows(
  revision: Pick<RevisionSummary, "isEmpty" | "filesLoaded" | "files">,
  filterQuery: string,
): readonly ChangedFileDisplayRow[] {
  const placeholderText = getChangedFilesPlaceholderText(revision);
  if (placeholderText) {
    return [{ kind: "placeholder", text: placeholderText }];
  }

  const visibleFiles = filterChangedFiles(revision.files, filterQuery);
  if (visibleFiles.length === 0) {
    return [{ kind: "placeholder", text: "No matching files" }];
  }

  // The index is the row's position in the filtered list, which is what
  // `focusedFileIndex` counts.
  return visibleFiles.map((file, index) => ({ kind: "file", file, index }));
}

function RevisionSideChips(props: {
  chips: readonly RevisionSideChip[];
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
  bookmarkLabelMaxLength: number | null;
  workspaceLabelMaxLength: number | null;
}) {
  return (
    <box flexDirection="row" flexShrink={0} gap={1}>
      <For each={props.chips}>
        {(chip) => {
          const maxLength = () => chip.kind === "bookmark"
            ? props.bookmarkLabelMaxLength
            : chip.kind === "workspace" ? props.workspaceLabelMaxLength : null;
          const foregroundColor = () => chip.kind === "conflict"
            ? props.colors.conflictTagText
            : chip.kind === "bookmark" ? props.colors.bookmarkTagText : props.colors.workspaceTagText;
          const backgroundColor = () => chip.kind === "conflict"
            ? props.colors.conflictTagFill
            : chip.kind === "bookmark" ? props.colors.bookmarkTagFill : props.colors.workspaceTagFill;

          // Loose headers are two rows tall; keep the chip fill on the identity row.
          return (
            <box
              height={1}
              flexShrink={0}
              paddingX={1}
              backgroundColor={backgroundColor()}
            >
              <text
                fg={foregroundColor()}
                maxWidth={maxLength() ?? undefined}
                wrapMode="none"
                truncate={maxLength() !== null}
              >
                {chip.text}
              </text>
            </box>
          );
        }}
      </For>
    </box>
  );
}

// The `/` filter input, drawn as the first row of the expanded file list. It
// stays mounted (unfocused) after Enter commits a query so the narrowed list
// keeps showing what narrowed it.
function ChangedFilesFilterRow(props: {
  actions: FileFilterActions;
  config: ResolvedAppConfig;
  focused: boolean;
  query: string;
}) {
  const colors = props.config.colorScheme.semanticColors;

  useKeyboard((event) => {
    if (event.eventType === "release" || !props.focused) {
      return;
    }

    if (event.name === "return") {
      event.preventDefault();
      props.actions.finalizeFileFilter();
    }
  }, { release: true });

  return (
    <box width="100%" flexDirection="row">
      <text flexShrink={0} fg={colors.textTertiary}>/ </text>
      <input
        flexGrow={1}
        minWidth={0}
        value={props.query}
        placeholder="filter files"
        focused={props.focused}
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        placeholderColor={colors.textQuaternary}
        cursorColor={colors.chromeBorderFocus}
        cursorStyle={{ style: "line" }}
        onInput={(value: string) => {
          props.actions.setFileFilterText(value);
        }}
      />
    </box>
  );
}

// Matches are drawn as inverse video, the same treatment the revision-log
// search overlay uses, so "this text matched" reads the same everywhere.
function ChangedFileName(props: {
  file: ChangedFile;
  filterQuery: string;
  color: string | undefined;
  config: ResolvedAppConfig;
}) {
  const colors = props.config.colorScheme.semanticColors;
  let textRef: any;

  createEffect(() => {
    if (!textRef) {
      return;
    }

    const baseColor = parseStyledColor(props.color);
    const matchFg = parseStyledColor(colors.chromeFillOne);
    const matchBg = parseStyledColor(colors.textPrimary);
    const chunks: TextChunk[] = buildChangedFileNameSegments(props.file, props.filterQuery)
      .map((segment) => ({
        __isChunk: true as const,
        text: segment.text,
        fg: segment.matched ? matchFg : baseColor,
        ...(segment.matched ? { bg: matchBg } : {}),
      }));
    textRef.content = new StyledText(chunks);
  });

  return (
    <text
      ref={textRef}
      flexShrink={1}
      minWidth={0}
      wrapMode="none"
      fg={props.color}
      truncate
    />
  );
}

function parseStyledColor(value: string | undefined): RGBA {
  if (!value) {
    return RGBA.fromValues(1, 1, 1, 1);
  }

  try {
    return RGBA.fromHex(value);
  } catch {
    return RGBA.fromValues(1, 1, 1, 1);
  }
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
      <ChangedFileName
        file={row.file}
        filterQuery={props.state.fileFilterQuery}
        color={rowState().selected || rowState().focused ? colors.textPrimary : colors.textSecondary}
        config={props.config}
      />
      <Show when={row.file.hasConflict}>
        <text fg={colors.statusError} attributes={TextAttributes.BOLD}> conflict</text>
      </Show>
    </box>
  );
}

function ChangedFiles(props: {
  fileFilterActions: FileFilterActions;
  state: AppStore["state"];
  revision: RevisionSummary;
  rows: readonly ChangedFileDisplayRow[];
  config: ResolvedAppConfig;
}) {
  const inlineConfirmation = createMemo(() =>
    props.state.inlineConfirmation?.rowId === props.revision.rowId
      ? props.state.inlineConfirmation
      : null
  );

  return (
    <box width="100%" flexDirection="column">
      <Show when={showsChangedFilesFilter(props.state)}>
        <ChangedFilesFilterRow
          actions={props.fileFilterActions}
          config={props.config}
          focused={props.state.focusMode === "file-filter"}
          query={props.state.fileFilterQuery}
        />
      </Show>
      <For each={props.rows}>
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

import { TextAttributes, CliRenderEvents, type ScrollBoxRenderable } from "@opentui/core";
import { For, Show, createEffect, createMemo, createRenderEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useKeyboard, useRenderer } from "@opentui/solid";
import { commandDefinitions, type CommandController } from "../commands/definitions.ts";
import { resolveAppConfig, type AppConfig, type ResolvedAppConfig } from "../config/schema.ts";
import { HistoryStore, matchHistoryEntries } from "../history/store.ts";
import type { AppStore } from "../state/appStore.ts";
import { getRevisionArg } from "../domain/revisionIds.ts";
import {
  commandCanExecute,
  DRAFT_PLACEHOLDER,
  draftConfigs,
  getCommandTargetRevisionId,
  getDisplayedCommandSegments,
  getDisplayedCommandText,
  getExpandedRevision,
  getFocusedRevisionArg,
  getFocusedRevision,
  isFileNavigationActive,
  getOperationAffectedRevisionIds,
  getSelectedRevisionIds,
  revisionMatchesSearch,
  type CommandSegment,
} from "../state/store.ts";
import { logShortcutDebug } from "../debug.ts";
import type { JjClient } from "../jj/client.ts";
import { runInteractiveCommand } from "../jj/process.ts";
import { buildCompletionItems, extractLastToken, matchCompletions, type CompletionItem } from "../revset/completions.ts";
import type { ChangedFile, RevisionSummary, StatusMessage } from "../domain/types.ts";
import { AutocompleteList, type AutocompleteListItem } from "./AutocompleteList.tsx";
import {
  getAutocompleteAction,
  moveAutocompleteSelection,
  type AutocompleteFlow,
} from "./autocomplete.ts";
import {
  getRevisionBorderPolicy,
  type RevisionRowState,
} from "./revisionBorders.ts";
import {
  buildRevisionGutterPlan,
  measureBoxedGraphWidth,
  measureGutterPlanWidth,
  splitGraphTitleSegments,
} from "./revisionGutter.ts";
import { buildRevisionLayoutSpec, type RevisionSideChip } from "./revisionLayout.ts";
import {
  buildRevisionChangeIdSegments,
  getRevisionChangeIdColors,
  getRevisionDescriptionColor,
} from "./revisionHeader.ts";
import { scrollToKeepChildVisible } from "./scroll.ts";
import {
  buildShortcutEntries,
  buildShortcutGrid,
  buildShortcutSummary,
  computeShortcutPanelHeight,
  getShortcutPanelCommands,
  shortcutModeLabel,
  type ShortcutGrid,
} from "./shortcutPanel.ts";
import { normalizeKey } from "./keyboard.ts";
import { dispatchGlobalKey } from "./keybindings.ts";
import { getActiveMode, getCommandsForMode, defaultKeymap } from "../modes.ts";
import { getChangedFileRowState, getChangedFilesPlaceholderText } from "./revisionFiles.ts";
import { saveGlobalSetting } from "../config/globalSettings.ts";
import { bindRefreshOnFocus, createRepositoryRefresher } from "./repositoryRefresh.ts";
import { startInitialRepositoryLoad } from "./startup.ts";
import { getStatusMessageDismissDelay } from "./statusMessages.ts";
import { parseAnsiToStyledText } from "./ansiToStyledText.ts";

export function JifView(props: {
  store: AppStore;
  client: JjClient;
  config: ResolvedAppConfig;
  rawConfig: AppConfig;
}) {
  const { store, client, rawConfig } = props;
  const [config, setConfig] = createStore<ResolvedAppConfig>(props.config);
  const [ready, setReady] = createSignal(false);
  const [workspaceRoot, setWorkspaceRoot] = createSignal<string | null>(null);
  const renderer = useRenderer();
  const [terminalSize, setTerminalSize] = createSignal({
    width: Math.max(renderer.width, 1),
    height: Math.max(renderer.height, 1),
  });
  const refreshRepository = createRepositoryRefresher({
    client,
    actions: store.actions,
    getRevsetQuery: () => store.snapshot().revsetQuery,
  });
  let logViewport: ScrollBoxRenderable | undefined;

  async function detectAndApplyPalette() {
    try {
      const palette = await renderer.getPalette({ size: 16 });
      setConfig(reconcile(resolveAppConfig(rawConfig, { palette })));
    } catch {
      // Keep current (fallback) colors
    }
  }

  onMount(() => {
    void (async () => {
      await startInitialRepositoryLoad({
        detectAndApplyPalette,
        loadWorkspaceRoot: () => client.loadWorkspaceRoot().catch(() => null),
        loadDefaultRevset: () => client.loadDefaultRevset(),
        loadSavedRevset: (resolvedWorkspaceRoot) => new HistoryStore(resolvedWorkspaceRoot).loadSetting("active-revset"),
        refreshRepository,
        setWorkspaceRoot,
        setRevsetQuery: (query) => {
          store.actions.setRevsetQuery(query);
        },
      });
      setReady(true);
      const disposeFocusRefresh = bindRefreshOnFocus(renderer, () => refreshRepository());
      onCleanup(() => disposeFocusRefresh());
    })();

    const handleThemeMode = () => {
      renderer.clearPaletteCache();
      void detectAndApplyPalette();
    };
    const handleResize = () => {
      setTerminalSize({
        width: Math.max(renderer.width, 1),
        height: Math.max(renderer.height, 1),
      });
    };
    handleResize();
    renderer.on(CliRenderEvents.THEME_MODE, handleThemeMode);
    renderer.on(CliRenderEvents.RESIZE, handleResize);
    onCleanup(() => {
      renderer.off(CliRenderEvents.THEME_MODE, handleThemeMode);
      renderer.off(CliRenderEvents.RESIZE, handleResize);
    });
  });

  const controller: CommandController = {
    moveFocus(delta: number) {
      store.actions.moveFocus(delta);
    },
    openFocusedRevision() {
      const state = store.snapshot();
      const revision = getFocusedRevision(state);
      if (!revision) {
        return;
      }

      if (revision.marker === "elided") {
        void expandElidedRevisions(state.focusedRevisionIndex);
        return;
      }

      store.actions.openFocusedRevision();
      if (revision.filesLoaded) {
        return;
      }

      void (async () => {
        try {
          const [files, conflictedPaths] = await Promise.all([
            client.loadChangedFiles(revision.revisionId),
            revision.hasConflict
              ? client.loadConflictedFiles(revision.revisionId)
              : Promise.resolve(new Set<string>()),
          ]);
          const enrichedFiles = conflictedPaths.size > 0
            ? files.map((f) => ({ ...f, hasConflict: conflictedPaths.has(f.path) }))
            : files;
          store.actions.setRevisionFiles(revision.revisionId, enrichedFiles);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          store.actions.pushEvent(message, "error");
        }
      })();
    },
    closeFocusedRevision() {
      store.actions.closeFocusedRevision();
    },
    quit() {
      renderer.destroy();
    },
    cancelOrBlur() {
      store.actions.cancelOrBlur();
    },
    confirm() {
      void executeCurrentCommand();
    },
    focusCommandBar() {
      store.actions.focusCommandBar();
    },
    startSquash() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.startCommandDraft(draftConfigs.squash);
    },
    startRebase() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(revision.revisionId);
          store.actions.startCommandDraft(draftConfigs.rebase, { descendantRevisionIds: descendants });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          store.actions.pushEvent(message, "error");
        }
      })();
    },
    startNewRevision() {
      const revisionArg = getFocusedRevisionArg(store.snapshot());
      if (!revisionArg) {
        return;
      }

      void runJjCommand(`new ${revisionArg}`, { focusWorkingCopyAfterRefresh: true });
    },
    editRevision() {
      const revisionArg = getFocusedRevisionArg(store.snapshot());
      if (!revisionArg) {
        return;
      }

      void runJjCommand(`edit ${revisionArg}`);
    },
    commit() {
      void runInteractiveJjCommand("commit");
    },
    describe() {
      const revisionArg = getFocusedRevisionArg(store.snapshot());
      if (!revisionArg) return;
      void runInteractiveJjCommand(`describe -r ${revisionArg}`);
    },
    showDiff() {
      const state = store.snapshot();
      const revisionArg = getFocusedRevisionArg(state);
      if (!revisionArg) return;
      if (isFileNavigationActive(state)) {
        const file = getExpandedRevision(state)?.files[state.focusedFileIndex];
        if (!file) return;
        void runInteractiveJjCommand(`diff -r ${revisionArg} ${file.path}`);
      } else {
        void runInteractiveJjCommand(`show -r ${revisionArg}`);
      }
    },
    toggleSelection() {
      store.actions.toggleRevisionSelection();
    },
    toggleFileSelection() {
      store.actions.toggleFileSelection();
    },
    restoreFiles() {
      const state = store.snapshot();
      if (state.focusMode !== "files" || !state.expandedRevisionId) {
        return;
      }

      const revision = getExpandedRevision(state);
      if (!revision) {
        return;
      }

      const revisionArg = getRevisionArg(revision.revisionId, revision.changeIdPrefixLength);
      const filePaths = state.selectedFilePaths.length > 0
        ? state.selectedFilePaths
        : [revision.files[state.focusedFileIndex]?.path].filter(Boolean);

      if (filePaths.length === 0) {
        return;
      }

      const commandText = `restore -c ${revisionArg} ${filePaths.join(" ")}`;
      void runJjCommand(commandText);
    },
    toggleShortFlags() {
      store.actions.toggleShortFlags();
    },
    cycleLayout() {
      store.actions.cycleLayout();
      void saveGlobalSetting("layout", store.snapshot().layout);
    },
    undo() {
      void runJjCommand("undo");
    },
    redo() {
      void runJjCommand("redo");
    },
    focusWorkingCopy() {
      store.actions.focusWorkingCopy();
    },
    openRevsetInput() {
      store.actions.openRevsetInput();
    },
    toggleShortcutPanel() {
      const before = store.snapshot().shortcutPanelExpanded;
      store.actions.toggleShortcutPanel();
      logShortcutDebug("toggle-shortcut-panel", {
        before,
        after: store.state.shortcutPanelExpanded,
        focusMode: store.state.focusMode,
      });
    },
    toggleRebaseDescendants() {
      const state = store.snapshot();
      if (state.commandDraft?.config.kind !== "rebase") {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(state.selectedRevisionIds[0] ?? "");
          store.actions.toggleRebaseDescendants(descendants);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          store.actions.pushEvent(message, "error");
        }
      })();
    },
    openSearch() {
      store.actions.openSearch();
    },
    nextSearchMatch() {
      store.actions.nextSearchMatch();
    },
    prevSearchMatch() {
      store.actions.prevSearchMatch();
    },
    refreshRepository() {
      void refreshRepository();
    },
    abandonRevision() {
      const revisionArg = getFocusedRevisionArg(store.snapshot());
      if (!revisionArg) return;
      void runJjCommand(`abandon ${revisionArg}`);
    },
  };

  const commandText = createMemo(() => {
    store.state.focusedRevisionIndex;
    store.state.commandDraft;
    store.state.commandBar;
    store.state.useShortFlags;
    store.state.selectedRevisionIds;
    return getDisplayedCommandText(store.state);
  });
  const commandSegments = createMemo((): readonly CommandSegment[] | null => {
    store.state.focusedRevisionIndex;
    store.state.commandDraft;
    store.state.commandBar;
    store.state.useShortFlags;
    store.state.selectedRevisionIds;
    return getDisplayedCommandSegments(store.state);
  });
  const activeMode = createMemo(() => getActiveMode(store.state));
  const visibleCommands = createMemo(() =>
    getCommandsForMode(activeMode(), defaultKeymap, commandDefinitions)
  );
  const shortcutCommands = createMemo(() =>
    getShortcutPanelCommands(store.state, visibleCommands())
  );
  const shortcutEntries = createMemo(() => buildShortcutEntries(shortcutCommands()));
  const shortcutSummary = createMemo(() => buildShortcutSummary(shortcutEntries()));
  const shortcutGrid = createMemo(() =>
    buildShortcutGrid(shortcutEntries(), Math.max(1, terminalSize().width - 4))
  );
  const shortcutPanelHeight = createMemo(() =>
    computeShortcutPanelHeight(terminalSize().height)
  );
  const shortcutPanelBodyHeight = createMemo(() =>
    Math.max(1, Math.min(shortcutGrid().rows.length, Math.max(1, shortcutPanelHeight() - 3)))
  );
  const shortcutPanelRenderedHeight = createMemo(() => shortcutPanelBodyHeight() + 4);
  const [promptSurfaceHeight, setPromptSurfaceHeight] = createSignal(3);
  const showsCommandPrompt = createMemo(() => store.state.focusMode === "command");
  const showsRevsetPrompt = createMemo(() => store.state.focusMode === "revset");
  const showsSearchPrompt = createMemo(() =>
    !showsCommandPrompt() && !showsRevsetPrompt() &&
    (store.state.focusMode === "search" || store.state.searchQuery !== "")
  );
  const showsShortcutPanel = createMemo(() =>
    !showsCommandPrompt() && !showsRevsetPrompt() && !showsSearchPrompt() &&
    store.state.shortcutPanelExpanded
  );
  const showsCommandPreview = createMemo(() =>
    !showsCommandPrompt() &&
    !showsRevsetPrompt() &&
    !showsSearchPrompt() &&
    !showsShortcutPanel() &&
    commandSegments() !== null
  );
  const bottomSurfaceHeight = createMemo(() => {
    if (showsCommandPrompt() || showsRevsetPrompt() || showsSearchPrompt() || showsCommandPreview()) {
      return promptSurfaceHeight();
    }

    if (showsShortcutPanel()) {
      return shortcutPanelRenderedHeight();
    }

    return 3;
  });

  createEffect(() => {
    logShortcutDebug("shortcut-panel-state", {
      expanded: store.state.shortcutPanelExpanded,
      focusMode: store.state.focusMode,
    });
  });

  useKeyboard((event) => {
    if (event.eventType === "release" || event.meta || event.option) {
      return;
    }

    const state = store.snapshot();
    const normalizedKey = event.ctrl ? `ctrl-${event.name}` : normalizeKey(event);
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
      commands: commandDefinitions,
      controller,
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

  createRenderEffect(() => {
    const focusedRevision = getFocusedRevision(store.state);
    if (!focusedRevision || !logViewport) {
      return;
    }

    const focusedIndex = store.state.focusedRevisionIndex;
    const direction = focusedIndex >= prevFocusedIndex ? "down" : "up";
    prevFocusedIndex = focusedIndex;

    const marginRevisionId = (() => {
      const margin = config.log.scrollMargin;
      const idx = direction === "down"
        ? Math.min(focusedIndex + margin, store.state.revisions.length - 1)
        : Math.max(focusedIndex - margin, 0);
      return (store.state.revisions[idx] ?? focusedRevision).revisionId;
    })();

    scrollToKeepChildVisible(logViewport, `revision-${marginRevisionId}`, direction);
  });

  createRenderEffect(() => {
    const expandedId = store.state.expandedRevisionId;
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



  return (
    <Show when={ready()}>
      <box
        width="100%"
        height="100%"
        flexDirection="column"
        backgroundColor={config.colorScheme.semanticColors.chromeFillOne}
      >
        <scrollbox
          ref={logViewport}
          width="100%"
          flexGrow={1}
          scrollY
          scrollbarOptions={{
            trackOptions: {
              backgroundColor: config.colorScheme.semanticColors.chromeFillThree,
              foregroundColor: config.colorScheme.semanticColors.chromeScrollbarThumb,
            },
          }}
        >
          <box width="100%" flexDirection="column">
            <For each={store.state.revisions}>
              {(revision, index) => (
                <RevisionItem
                  state={store.state}
                  revision={revision}
                  index={index()}
                  previousRevisionId={store.state.revisions[index() - 1]?.revisionId ?? null}
                  nextRevisionId={store.state.revisions[index() + 1]?.revisionId ?? null}
                  config={config}
                  focusedRevisionId={getFocusedRevision(store.state)?.revisionId ?? null}
                  selectedRevisionIds={getSelectedRevisionIds(store.state)}
                  expandedRevisionId={getExpandedRevision(store.state)?.revisionId ?? null}
                  commandTargetId={getCommandTargetRevisionId(store.state)}
                  searchQuery={store.state.searchQuery}
                />
              )}
            </For>
          </box>
        </scrollbox>
        <Show when={showsCommandPrompt()}>
          <CommandPrompt
            store={store}
            config={config}
            workspaceRoot={workspaceRoot()}
            commandText={commandText()}
            onSubmit={(value) => {
              store.actions.setCommandBarText(value);
              void executeCurrentCommand(value, { recordHistory: true });
            }}
            onHeightChange={setPromptSurfaceHeight}
          />
        </Show>
        <Show when={showsRevsetPrompt()}>
          <RevsetPrompt
            revsetQuery={store.state.revsetQuery}
            client={client}
            config={config}
            workspaceRoot={workspaceRoot()}
            onApply={async (query) => {
              const previousQuery = store.state.revsetQuery;
              store.actions.setRevsetQuery(query);
              store.actions.closeRevsetInput();
              const success = await refreshRepository(query || undefined);
              if (success) {
                if (workspaceRoot()) {
                  await new HistoryStore(workspaceRoot()!).record("revset-history", query);
                  await new HistoryStore(workspaceRoot()!).saveSetting("active-revset", query);
                }
              } else {
                store.actions.setRevsetQuery(previousQuery);
                void refreshRepository(previousQuery || undefined);
              }
            }}
            onCancel={() => {
              store.actions.closeRevsetInput();
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
        <Show when={!showsCommandPrompt() && !showsRevsetPrompt() && !showsSearchPrompt() && !showsCommandPreview()}>
          <StatusArea
            shortcutSummary={shortcutSummary()}
            shortcutGrid={shortcutGrid()}
            expanded={showsShortcutPanel()}
            currentModeLabel={shortcutModeLabel(activeMode())}
            panelBodyHeight={shortcutPanelBodyHeight()}
            config={config}
          />
        </Show>
        <MessageOverlay
          messages={store.state.statusMessages}
          loading={store.state.loading}
          config={config}
          bottomInset={bottomSurfaceHeight()}
          onDismiss={(id) => store.actions.dismissStatusMessage(id)}
        />
      </box>
    </Show>
  );

  async function executeCurrentCommand(
    commandOverride?: string,
    options?: { recordHistory?: boolean },
  ) {
    const state = store.snapshot();
    const commandTextValue = (commandOverride ?? getDisplayedCommandText(state)).trim();
    if (!commandCanExecute(state) || commandTextValue.length === 0) {
      return;
    }

    if (options?.recordHistory && workspaceRoot()) {
      void new HistoryStore(workspaceRoot()!).record("command-history", commandTextValue);
    }

    store.actions.cancelCommand();

    const toastId = `cmd-${Date.now()}`;
    store.actions.pushStatusMessage(toastId, commandTextValue, "info");

    try {
      const resultMessage = await client.executeCommand(commandTextValue);
      store.actions.updateStatusMessage(toastId, resultMessage, "success");
      store.actions.logEvent(resultMessage, "success");
      await refreshRepository();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.updateStatusMessage(toastId, message, "error");
      store.actions.logEvent(message, "error");
    }
  }

  async function runJjCommand(
    commandText: string,
    options?: { focusWorkingCopyAfterRefresh?: boolean },
  ) {
    store.actions.setLoading(true);
    try {
      const resultMessage = await client.executeCommand(commandText);
      store.actions.cancelCommand();
      store.actions.pushEvent(resultMessage, "success");
      await refreshRepository();
      if (options?.focusWorkingCopyAfterRefresh) {
        store.actions.focusWorkingCopy();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.pushEvent(message, "error");
      store.actions.setLoading(false);
    }
  }

  async function runInteractiveJjCommand(commandText: string) {
    const root = workspaceRoot();
    if (!root) return;
    renderer.suspend();
    try {
      await runInteractiveCommand(root, ["jj", ...commandText.split(" ")]);
      store.actions.cancelCommand();
      await refreshRepository();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.pushEvent(message, "error");
    } finally {
      renderer.resume();
    }
  }

  async function expandElidedRevisions(elidedIndex: number) {
    const state = store.snapshot();
    const afterRevision = state.revisions[elidedIndex + 1];
    const beforeRevision = state.revisions[elidedIndex - 1];
    if (!afterRevision) {
      return;
    }
    try {
      const revisions = await client.loadElidedRevisions(
        afterRevision.revisionId,
        beforeRevision?.revisionId ?? null,
        20,
      );
      store.actions.expandElidedRevision(elidedIndex, revisions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.pushEvent(message, "error");
    }
  }
}

function PromptShell(props: {
  config: ResolvedAppConfig;
  items: readonly AutocompleteListItem[];
  selectedIndex: number | null;
  flow: AutocompleteFlow;
  focused: boolean;
  onHeightChange?: (height: number) => void;
  children: any;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const autocompleteHeight = createMemo(() => Math.min(props.items.length, 10));
  const totalHeight = createMemo(() => 3 + autocompleteHeight());

  createEffect(() => {
    props.onHeightChange?.(totalHeight());
  });

  return (
    <box
      width="100%"
      height={totalHeight()}
      flexDirection="column"
    >
      <Show when={props.items.length > 0}>
        <AutocompleteList
          items={props.items}
          selectedIndex={props.selectedIndex}
          flow={props.flow}
          config={props.config}
        />
      </Show>
      <box
        width="100%"
        height={3}
        flexDirection="row"
        paddingX={1}
        border
        borderStyle="single"
        borderColor={props.focused ? colors.chromeBorderFocus : colors.chromeBorderIdle}
        backgroundColor={props.focused ? colors.chromeFillTwo : colors.chromeFillOne}
      >
        {props.children}
      </box>
    </box>
  );
}

function CommandPrompt(props: {
  store: AppStore;
  config: ResolvedAppConfig;
  workspaceRoot: string | null;
  commandText: string;
  onSubmit: (value: string) => void;
  onHeightChange?: (height: number) => void;
}) {
  const { store, config } = props;
  const colors = config.colorScheme.semanticColors;
  const flow: AutocompleteFlow = "bottom-to-top";
  const [historyEntries, setHistoryEntries] = createSignal<string[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);

  createEffect(() => {
    const workspaceRoot = props.workspaceRoot;

    if (!workspaceRoot) {
      setHistoryEntries([]);
      setSelectedIndex(null);
      return;
    }

    void new HistoryStore(workspaceRoot).load("command-history").then(setHistoryEntries);
  });

  createEffect(() => {
    props.commandText;
    setSelectedIndex(null);
  });

  const filteredHistory = createMemo(() => matchHistoryEntries(props.commandText, historyEntries()));

  const autocompleteItems = createMemo<AutocompleteListItem[]>(() =>
    filteredHistory().map((entry) => ({
      id: entry,
      text: entry,
    }))
  );

  useKeyboard((event) => {
    if (event.eventType === "release") {
      return;
    }

    const action = getAutocompleteAction(event, flow);
    if (action !== null) {
      event.preventDefault();
      setSelectedIndex((currentIndex) =>
        moveAutocompleteSelection(currentIndex, filteredHistory().length, action)
      );
      return;
    }

    if (event.name !== "return") {
      return;
    }

    const index = selectedIndex();
    if (index === null) {
      return;
    }

    const entry = filteredHistory()[index];
    if (!entry) {
      return;
    }

    event.preventDefault();
    store.actions.setCommandBarText(entry);
    setSelectedIndex(null);
  }, { release: true });

  return (
    <PromptShell
      config={config}
      items={autocompleteItems()}
      selectedIndex={selectedIndex()}
      flow={flow}
      focused
      onHeightChange={props.onHeightChange}
    >
      <box width={4} flexDirection="row" flexShrink={0}>
        <text fg={colors.textPrimary}>jj </text>
      </box>
      <input
        ref={(el: any) => el.editorView.setScrollMargin(0)}
        flexGrow={1}
        value={props.commandText}
        placeholder="subcommand"
        focused
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        placeholderColor={colors.textQuaternary}
        cursorColor={colors.chromeBorderFocus}
        onInput={(value) => {
          store.actions.setCommandBarText(value);
        }}
        onSubmit={props.onSubmit as any}
      />
    </PromptShell>
  );
}

function CommandPreview(props: {
  config: ResolvedAppConfig;
  commandSegments: readonly CommandSegment[];
  onHeightChange?: (height: number) => void;
}) {
  const colors = props.config.colorScheme.semanticColors;

  return (
    <PromptShell
      config={props.config}
      items={[]}
      selectedIndex={null}
      flow="bottom-to-top"
      focused={false}
      onHeightChange={props.onHeightChange}
    >
      <box width={4} flexDirection="row" flexShrink={0}>
        <text fg={colors.textTertiary}>jj </text>
      </box>
      <box flexGrow={1} flexDirection="row">
        <For each={props.commandSegments}>
          {(segment) => (
            <text
              fg={segment.style === "selected"
                ? colors.rowSelectedAccent
                : segment.style === "target"
                  ? colors.chromeBorderFocus
                  : segment.style === "placeholder"
                    ? colors.chromeBorderFocus
                    : colors.textPrimary}
              attributes={segment.style !== "command" ? TextAttributes.BOLD : undefined}
            >
              {segment.text}
            </text>
          )}
        </For>
      </box>
    </PromptShell>
  );
}

function SearchPrompt(props: {
  store: AppStore;
  config: ResolvedAppConfig;
  focused: boolean;
  searchQuery: string;
  onHeightChange?: (height: number) => void;
}) {
  const { store, config } = props;
  const colors = config.colorScheme.semanticColors;

  useKeyboard((event) => {
    if (event.eventType === "release") {
      return;
    }

    if (event.name === "return") {
      event.preventDefault();
      store.actions.finalizeSearch();
      return;
    }
  }, { release: true });

  return (
    <PromptShell
      config={config}
      items={[]}
      selectedIndex={null}
      flow="bottom-to-top"
      focused={props.focused}
      onHeightChange={props.onHeightChange}
    >
      <box width={2} flexDirection="row" flexShrink={0}>
        <text fg={colors.textPrimary}>/ </text>
      </box>
      <input
        flexGrow={1}
        value={props.searchQuery}
        placeholder="search"
        focused={props.focused}
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        placeholderColor={colors.textQuaternary}
        cursorColor={colors.chromeBorderFocus}
        onInput={(value) => {
          store.actions.setSearchText(value);
        }}
      />
    </PromptShell>
  );
}

export function RevisionItem(props: {
  state: AppStore["state"];
  revision: RevisionSummary;
  index: number;
  previousRevisionId: string | null;
  nextRevisionId: string | null;
  config: ResolvedAppConfig;
  focusedRevisionId: string | null;
  selectedRevisionIds: ReadonlySet<string>;
  expandedRevisionId: string | null;
  commandTargetId: string | null;
  searchQuery: string;
}) {
  const colors = () => props.config.colorScheme.semanticColors;
  const affectedIds = createMemo(() => getOperationAffectedRevisionIds(props.state));
  const isFocused = () => props.revision.revisionId === props.focusedRevisionId;
  const isSelected = () => props.selectedRevisionIds.has(props.revision.revisionId);
  const isExpanded = () => props.revision.revisionId === props.expandedRevisionId;
  const anyExpanded = () => props.expandedRevisionId !== null;
  const isAffected = () => affectedIds().has(props.revision.revisionId);
  const isCommandTarget = () => props.commandTargetId === props.revision.revisionId;
  const isSearchMatch = () => revisionMatchesSearch(props.revision, props.searchQuery);
  const changedFileRows = createMemo(() => isExpanded() ? buildChangedFileDisplayRows(props.revision) : []);
  const rowState = createMemo(() =>
    getRevisionRowState(props.revision.revisionId, props.focusedRevisionId, props.selectedRevisionIds) ?? "default",
  );
  const previousRowState = createMemo(() =>
    getRevisionRowState(props.previousRevisionId, props.focusedRevisionId, props.selectedRevisionIds),
  );
  const nextRowState = createMemo(() =>
    getRevisionRowState(props.nextRevisionId, props.focusedRevisionId, props.selectedRevisionIds),
  );
  const detailRowCount = () => isExpanded() ? Math.max(props.revision.files.length, 1) : 0;
  const layoutSpec = createMemo(() =>
    buildRevisionLayoutSpec(props.revision, {
      mode: props.state.layout,
      isCommandTarget: isCommandTarget(),
      badgeText: props.state.commandDraft?.config.badgeText ?? "onto",
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
      isCommandTarget: false,
      badgeText: props.state.commandDraft?.config.badgeText ?? "onto",
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
      isCommandTarget: false,
      badgeText: props.state.commandDraft?.config.badgeText ?? "onto",
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
    if (rs === "default" && props.previousRevisionId !== null && affectedIds().has(props.previousRevisionId)) return "affected";
    return rs;
  });
  const nextEffectiveRowState = createMemo((): RevisionRowState | null => {
    const rs = nextRowState();
    if (rs === "default" && props.nextRevisionId !== null && affectedIds().has(props.nextRevisionId)) return "affected";
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
      isCommandTarget: false,
      badgeText: props.state.commandDraft?.config.badgeText ?? "onto",
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
    isSelected()
      ? colors().rowSelectedFill
      : isFocused()
        ? colors().rowFocusedFill
        : isAffected()
          ? colors().rowAffectedFill
          : undefined
  );
  const showExpandedTimestamp = () => layoutSpec().mode === "expanded";
  const superGutterPlan = createMemo(() => buildRevisionGutterPlan({
    graphRows: props.revision.graphRows,
    baseGraphRowCount: layoutSpec().baseGraphRowCount,
    visibleGraphMode: layoutSpec().visibleGraphMode,
    detailRowCount: changedFileRows().length,
    ownsTop: false,
    ownsBottom: false,
    previousGraphBottom: null,
    hasNextRevision: false,
  }));
  const superGraphWidth = createMemo(() => measureGutterPlanWidth(superGutterPlan()));

  return (
    <box
      id={`revision-${props.revision.revisionId}`}
      width="100%"
      flexDirection="column"
      opacity={anyExpanded() && !isExpanded() ? 0.6 : 1}
    >
      <Show
        when={layoutSpec().mode === "super-condensed"}
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
              paddingRight={1}
              backgroundColor={rowBackgroundColor()}
              border={borderPolicy().borderSides}
              borderStyle="single"
              borderColor={borderColor()}
              customBorderChars={borderPolicy().borderChars}
            >
              <Show
                when={props.revision.marker !== "elided"}
                fallback={
                  <text fg={colors().textTertiary} truncate>
                    {props.revision.description}
                  </text>
                }
              >
                <Show
                  when={layoutSpec().headerRowCount === 1}
                  fallback={
                    <>
                      <box width="100%" flexDirection="row" gap={1}>
                        <RevisionChangeId
                          revision={props.revision}
                          rowState={effectiveRowState()}
                          colors={colors()}
                          showTimestamp={showExpandedTimestamp()}
                        />
                        {layoutSpec().commandTarget ? (
                          <CommandTargetChip
                            text={layoutSpec().commandTarget!.text}
                            colors={colors()}
                          />
                        ) : null}
                        <box flexGrow={1} />
                        <RevisionSideChips chips={layoutSpec().sideChips} colors={colors()} />
                      </box>
                      <box width="100%" flexDirection="row">
                        <text
                          fg={descriptionColor()}
                          truncate
                          attributes={isSearchMatch() ? TextAttributes.INVERSE : undefined}
                        >
                          {props.revision.description}
                        </text>
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
                        rowState={effectiveRowState()}
                        colors={colors()}
                        showTimestamp={showExpandedTimestamp()}
                      />
                      <Show when={layoutSpec().sideChips.length > 0}>
                        <box width={1} />
                      </Show>
                      <RevisionSideChips chips={layoutSpec().sideChips} colors={colors()} />
                      <box width={1} />
                      <box flexGrow={1} minWidth={0} height={1} overflow="hidden" flexDirection="row">
                        <text
                          fg={descriptionColor()}
                          wrapMode="none"
                          truncate
                          attributes={isSearchMatch() ? TextAttributes.INVERSE : undefined}
                        >
                          {props.revision.description}
                        </text>
                      </box>
                    </box>
                    {layoutSpec().commandTarget?.placement === "overlay" ? (
                      <text
                        position="absolute"
                        left={layoutSpec().commandTarget!.leftOffset}
                        top={0}
                        zIndex={1}
                        fg={colors().chromeFillOne}
                        bg={colors().chromeBorderFocus}
                      >
                        {` ${layoutSpec().commandTarget!.text} `}
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
        <box width="100%" flexDirection="row">
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
            gap={1}
            backgroundColor={rowBackgroundColor()}
          >
            <Show
              when={props.revision.marker !== "elided"}
              fallback={
                <text fg={colors().textTertiary} wrapMode="none" truncate>
                  {props.revision.description}
                </text>
              }
            >
              <RevisionChangeId
                revision={props.revision}
                rowState={effectiveRowState()}
                colors={colors()}
                showTimestamp={false}
              />
              {layoutSpec().commandTarget ? (
                <CommandTargetChip
                  text={layoutSpec().commandTarget!.text}
                  colors={colors()}
                />
              ) : null}
              <RevisionSideChips chips={layoutSpec().sideChips} colors={colors()} />
              <box flexGrow={1} minWidth={0} height={1} overflow="hidden" flexDirection="row">
                <text
                  fg={descriptionColor()}
                  wrapMode="none"
                  truncate
                  attributes={isSearchMatch() ? TextAttributes.INVERSE : undefined}
                >
                  {props.revision.description}
                </text>
              </box>
            </Show>
          </box>
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
                  revisionId={props.revision.revisionId}
                  row={row}
                  config={props.config}
                />
              </box>
            </box>
          )}
        </For>
      </Show>
      <Show when={layoutSpec().mode !== "super-condensed"}>
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
  revision: Pick<RevisionSummary, "revisionId" | "changeIdPrefixLength" | "localTimestamp">;
  rowState: RevisionRowState;
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
  showTimestamp: boolean;
}) {
  const segments = createMemo(() =>
    buildRevisionChangeIdSegments(props.revision, { showTimestamp: props.showTimestamp })
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

function CommandTargetChip(props: {
  text: string;
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
}) {
  return (
    <text fg={props.colors.chromeFillOne} bg={props.colors.chromeBorderFocus}>
      {` ${props.text} `}
    </text>
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
          const fg = chip.kind === "conflict" ? props.colors.conflictTagText
            : chip.kind === "bookmark" ? props.colors.workspaceTagText
            : props.colors.bookmarkTagText;
          const bg = chip.kind === "conflict" ? props.colors.conflictTagFill
            : chip.kind === "bookmark" ? props.colors.workspaceTagFill
            : props.colors.bookmarkTagFill;
          return (
            <text fg={fg} bg={bg}>
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
  revisionId: string;
  row: ChangedFileDisplayRow;
  config: ResolvedAppConfig;
}) {
  const colors = props.config.colorScheme.semanticColors;

  if (props.row.kind === "placeholder") {
    return <text fg={colors.textTertiary}>{props.row.text}</text>;
  }

  const row = props.row;

  const rowState = createMemo(() =>
    getChangedFileRowState(props.state, props.revisionId, row.index, row.file.path)
  );

  return (
    <box
      width="100%"
      flexDirection="row"
      gap={1}
      backgroundColor={
        rowState().selected
          ? colors.rowSelectedFill
          : rowState().focused
            ? colors.rowFocusedFill
            : undefined
      }
    >
      <text
        fg={
          rowState().selected
            ? colors.rowSelectedAccent
            : rowState().focused
              ? colors.fileFocusMarker
              : colors.textTertiary
        }
      >
        {rowState().marker}
      </text>
      <text fg={colors.fileStatusAccent}>{row.file.status}</text>
      <text fg={rowState().selected || rowState().focused ? colors.textPrimary : colors.textSecondary} truncate>
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

  return (
    <box width="100%" flexDirection="column">
      <For each={rows()}>
        {(row) => (
          <ChangedFileRowContent
            state={props.state}
            revisionId={props.revision.revisionId}
            row={row}
            config={props.config}
          />
        )}
      </For>
    </box>
  );
}

function StatusArea(props: {
  shortcutSummary: string;
  shortcutGrid: ShortcutGrid;
  expanded: boolean;
  currentModeLabel: string;
  panelBodyHeight: number;
  config: ResolvedAppConfig;
}) {
  const colors = props.config.colorScheme.semanticColors;

  return (
    <Show
      when={props.expanded}
      fallback={
        <box
          width="100%"
          height={3}
          border
          borderStyle="single"
          borderColor={colors.chromeBorderIdle}
          backgroundColor={colors.chromeFillOne}
          paddingX={1}
          flexDirection="row"
        >
          <text fg={colors.textTertiary} truncate>
            {props.shortcutSummary}
          </text>
        </box>
      }
    >
      <box
        width="100%"
        height={props.panelBodyHeight + 4}
        border
        borderStyle="single"
        borderColor={colors.chromeBorderFocus}
        backgroundColor={colors.chromeFillTwo}
        flexDirection="column"
      >
        <box
          width="100%"
          flexDirection="row"
          paddingX={1}
          backgroundColor={colors.chromeFillTwo}
        >
          <text fg={colors.textPrimary} attributes={TextAttributes.BOLD}>
            Shortcuts
          </text>
          <text fg={colors.textTertiary}>{` ${props.currentModeLabel}`}</text>
          <box flexGrow={1} />
          <text fg={colors.textTertiary}>? close</text>
        </box>
        <box width="100%" height={1} backgroundColor={colors.chromeFillTwo} />
        <scrollbox
          width="100%"
          height={props.panelBodyHeight}
          scrollY
          backgroundColor={colors.chromeFillTwo}
          scrollbarOptions={{
            trackOptions: {
              backgroundColor: colors.chromeFillThree,
              foregroundColor: colors.chromeScrollbarThumb,
            },
          }}
        >
          <Show
            when={props.shortcutGrid.rows.length > 0}
            fallback={
              <box width="100%" paddingX={1}>
                <text fg={colors.textTertiary}>No shortcuts for this mode.</text>
              </box>
            }
          >
            <box width="100%" flexDirection="column" paddingX={1}>
              <For each={props.shortcutGrid.rows}>
                {(row) => (
                  <box width="100%" flexDirection="row" gap={props.shortcutGrid.gap}>
                    <For each={row}>
                      {(entry) => (
                        <box
                          width={props.shortcutGrid.columnWidth}
                          minWidth={0}
                          flexDirection="row"
                        >
                          <box width={props.shortcutGrid.keyWidth} flexShrink={0}>
                            <text
                              fg={colors.chromeBorderFocus}
                              attributes={TextAttributes.BOLD}
                              truncate
                            >
                              {entry.keyLabel}
                            </text>
                          </box>
                          <box flexGrow={1} minWidth={0}>
                            <text fg={colors.textSecondary} truncate>
                              {` ${entry.title}`}
                            </text>
                          </box>
                        </box>
                      )}
                    </For>
                  </box>
                )}
              </For>
            </box>
          </Show>
        </scrollbox>
      </box>
    </Show>
  );
}

function RevsetPrompt(props: {
  revsetQuery: string;
  client: JjClient;
  config: ResolvedAppConfig;
  workspaceRoot: string | null;
  onApply: (query: string) => void | Promise<void>;
  onCancel: () => void;
  onHeightChange?: (height: number) => void;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const flow: AutocompleteFlow = "bottom-to-top";
  const [text, setText] = createSignal(props.revsetQuery);
  const [completionItems, setCompletionItems] = createSignal<CompletionItem[]>([]);
  const [historyEntries, setHistoryEntries] = createSignal<string[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);

  const suggestions = createMemo<AutocompleteListItem[]>(() => {
    if (text().trim().length === 0) {
      return historyEntries().map((entry) => ({
        id: `history:${entry}`,
        tag: "hs",
        text: entry,
      }));
    }

    const { token } = extractLastToken(text());
    return matchCompletions(token, completionItems()).map((item) => ({
      id: `completion:${item.kind}:${item.name}`,
      tag: completionKindLabel(item.kind),
      text: item.name,
      detail: item.detail,
    }));
  });

  onMount(() => {
    void (async () => {
      const [bookmarks, tags, aliases, history] = await Promise.all([
        props.client.loadBookmarks(),
        props.client.loadTags(),
        props.client.loadAliases(),
        props.workspaceRoot
          ? new HistoryStore(props.workspaceRoot).load("revset-history")
          : Promise.resolve([]),
      ]);
      setCompletionItems(buildCompletionItems(bookmarks, tags, aliases));
      setHistoryEntries(history);
    })();
  });

  const applySuggestion = (item: AutocompleteListItem) => {
    if (item.tag === "hs") {
      setText(item.text);
      setSelectedIndex(null);
      return;
    }

    const completion = completionItems().find((candidate) => candidate.name === item.text);
    if (!completion) {
      return;
    }

    const current = text();
    const { start } = extractLastToken(current);
    let nextValue = completion.name;
    if (completion.kind === "function") {
      nextValue += completion.hasParameters ? "(" : "()";
    }
    setText(current.slice(0, start) + nextValue);
    setSelectedIndex(null);
  };

  useKeyboard((event) => {
    if (event.eventType === "release" || event.meta || event.option) {
      return;
    }

    const action = getAutocompleteAction(event, flow);
    if (action !== null) {
      event.preventDefault();
      setSelectedIndex((currentIndex) =>
        moveAutocompleteSelection(currentIndex, suggestions().length, action)
      );
      return;
    }

    if (event.name === "return") {
      event.preventDefault();
      const idx = selectedIndex();
      const items = suggestions();
      if (idx !== null && idx < items.length) {
        applySuggestion(items[idx]!);
      } else {
        void props.onApply(text());
      }
      return;
    }

    if (event.name === "escape") {
      event.preventDefault();
      props.onCancel();
      return;
    }
  }, { release: true });

  return (
    <PromptShell
      config={props.config}
      items={suggestions()}
      selectedIndex={selectedIndex()}
      flow={flow}
      focused
      onHeightChange={props.onHeightChange}
    >
      <Show when={text().length === 0}>
        <text fg={colors.textTertiary}>Revset: </text>
      </Show>
      <input
        flexGrow={1}
        value={text()}
        focused
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        cursorColor={colors.chromeBorderFocus}
        onInput={(value) => {
          setText(value);
          setSelectedIndex(null);
        }}
      />
    </PromptShell>
  );
}

function MessageOverlay(props: {
  messages: readonly StatusMessage[];
  loading: boolean;
  config: ResolvedAppConfig;
  bottomInset: number;
  onDismiss: (id?: string) => void;
}) {
  const visible = () => props.messages.length > 0 || props.loading;

  return (
    <Show when={visible()}>
      <box
        position="absolute"
        bottom={props.bottomInset}
        left={0}
        width="100%"
        zIndex={10}
        flexDirection="column-reverse"
      >
        <Show when={props.loading}>
          <LoadingOverlay config={props.config} />
        </Show>
        <Show when={props.messages.length > 0}>
          <box width="100%" flexDirection="column-reverse">
            <For each={props.messages}>
              {(message) => (
                <StatusToast
                  message={message}
                  config={props.config}
                  onDismiss={() => props.onDismiss(message.id)}
                />
              )}
            </For>
          </box>
        </Show>
      </box>
    </Show>
  );
}

function LoadingOverlay(props: {
  config: ResolvedAppConfig;
}) {
  const colors = props.config.colorScheme.semanticColors;

  return (
    <box
      width="100%"
      backgroundColor={colors.chromeFillOne}
      border
      borderStyle="single"
      borderColor={statusColor("info", colors)}
      paddingX={1}
    >
      <text fg={statusColor("info", colors)} wrapMode="word">
        Refreshing repository state...
      </text>
    </box>
  );
}

function StatusToast(props: {
  message: StatusMessage;
  config: ResolvedAppConfig;
  onDismiss: () => void;
}) {
  const colors = props.config.colorScheme.semanticColors;

  createEffect(() => {
    if (props.message.level !== "success") return;
    const timer = setTimeout(
      props.onDismiss,
      getStatusMessageDismissDelay(props.message.createdAt),
    );
    onCleanup(() => clearTimeout(timer));
  });

  let textRef: any;

  createEffect(() => {
    if (textRef) {
      textRef.content = parseAnsiToStyledText(props.message.text, props.config.terminalPalette);
    }
  });

  return (
    <box
      width="100%"
      backgroundColor={colors.chromeFillOne}
      border
      borderStyle="single"
      borderColor={statusColor(props.message.level, colors)}
      paddingX={1}
    >
      <text ref={textRef} fg={colors.textPrimary} wrapMode="word" />
    </box>
  );
}
function completionKindLabel(kind: CompletionItem["kind"]): string {
  switch (kind) {
    case "function": return "fn";
    case "bookmark": return "bm";
    case "tag": return "tg";
    case "alias": return "al";
  }
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
  revisionId: string | null,
  focusedRevisionId: string | null,
  selectedRevisionIds: ReadonlySet<string>,
): RevisionRowState | null {
  if (revisionId === null) {
    return null;
  }

  if (selectedRevisionIds.has(revisionId)) {
    return "selected";
  }

  if (revisionId === focusedRevisionId) {
    return "focused";
  }

  return "default";
}

function statusColor(
  level: "info" | "success" | "warning" | "error",
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"],
): string | undefined {
  switch (level) {
    case "success":
      return colors.statusSuccess;
    case "warning":
      return colors.statusWarning;
    case "error":
      return colors.statusError;
    default:
      return colors.statusInfo;
  }
}

function padRight(value: string, length: number): string {
  if (value.length >= length) {
    return value;
  }

  return `${value}${" ".repeat(length - value.length)}`;
}

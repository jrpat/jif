import { TextAttributes, CliRenderEvents, type ScrollBoxRenderable } from "@opentui/core";
import { For, Show, createEffect, createMemo, createRenderEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useKeyboard, useRenderer } from "@opentui/solid";
import { getVisibleCommands, type CommandController } from "../commands/definitions.ts";
import { resolveAppConfig, type AppConfig, type ResolvedAppConfig } from "../config/index.ts";
import { HistoryStore, matchHistoryEntries } from "../history/store.ts";
import type { AppStore } from "../state/appStore.ts";
import {
  commandCanExecute,
  DRAFT_PLACEHOLDER,
  draftConfigs,
  getCommandTargetRevisionId,
  getDisplayedCommandSegments,
  getDisplayedCommandText,
  getExpandedRevision,
  getFocusedRevision,
  getOperationAffectedRevisionIds,
  getSelectedRevisionIds,
  type CommandSegment,
} from "../state/store.ts";
import { logShortcutDebug } from "../debug.ts";
import type { JjClient } from "../jj/client.ts";
import { buildCompletionItems, extractLastToken, matchCompletions, type CompletionItem } from "../revset/completions.ts";
import type { RevisionSummary, StatusMessage } from "../domain/types.ts";
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
  buildCondensedGraphLine,
  buildRevisionGutterPlan,
  measureCoreGraphWidth,
  measureGutterPlanWidth,
} from "./revisionGutter.ts";
import { buildRevisionHeaderLayout, type RevisionSideChip } from "./revisionLayout.ts";
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
import { getChangedFileRowState, getChangedFilesPlaceholderText } from "./revisionFiles.ts";
import { getStatusMessageDismissDelay } from "./statusMessages.ts";

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
    void detectAndApplyPalette().then(() => setReady(true));

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
          const files = await client.loadChangedFiles(revision.changeId);
          store.actions.setRevisionFiles(revision.changeId, files);
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
      const state = store.snapshot();

      if (state.statusMessages.length > 0) {
        store.actions.dismissStatusMessage();
        return;
      }

      if (state.focusMode === "command") {
        store.actions.cancelCommand();
        return;
      }

      if (state.commandDraft !== null) {
        store.actions.cancelCommandDraft();
        return;
      }

      if (state.selectedRevisionIds.length > 0) {
        store.actions.clearRevisionSelection();
        return;
      }

      if (state.focusMode === "files") {
        store.actions.closeFocusedRevision();
        return;
      }
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
          const descendants = await client.resolveDescendants(revision.changeId);
          store.actions.startCommandDraft(draftConfigs.rebase, { descendantRevisionIds: descendants });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          store.actions.pushEvent(message, "error");
        }
      })();
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

      const changePrefix = revision.changeId.slice(0, revision.changeIdPrefixLength);
      const filePaths = state.selectedFilePaths.length > 0
        ? state.selectedFilePaths
        : [revision.files[state.focusedFileIndex]?.path].filter(Boolean);

      if (filePaths.length === 0) {
        return;
      }

      const commandText = `restore -c ${changePrefix} ${filePaths.join(" ")}`;
      void runJjCommand(commandText);
    },
    toggleShortFlags() {
      store.actions.toggleShortFlags();
    },
    toggleCondensedLayout() {
      store.actions.toggleCondensedLayout();
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
  const visibleCommands = createMemo(() => getVisibleCommands(store.state));
  const shortcutCommands = createMemo(() =>
    getShortcutPanelCommands(store.state, visibleCommands())
  );
  const visibleEvents = createMemo(() => store.state.eventLog.slice(-3).reverse());
  const shortcutEntries = createMemo(() => buildShortcutEntries(shortcutCommands()));
  const shortcutSummary = createMemo(() => buildShortcutSummary(shortcutEntries()));
  const shortcutGrid = createMemo(() =>
    buildShortcutGrid(shortcutEntries(), Math.max(1, terminalSize().width - 4))
  );
  const shortcutPanelHeight = createMemo(() =>
    computeShortcutPanelHeight(terminalSize().height)
  );
  const canToggleShortcutPanel = createMemo(() =>
    store.state.focusMode !== "command" && store.state.focusMode !== "revset"
  );

  createEffect(() => {
    logShortcutDebug("shortcut-panel-state", {
      expanded: store.state.shortcutPanelExpanded,
      focusMode: store.state.focusMode,
    });
  });

  useKeyboard((event) => {
    if (event.eventType === "release" || event.ctrl || event.meta || event.option) {
      return;
    }

    const state = store.snapshot();
    const normalizedKey = normalizeKey(event);
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
      visibleCommands: visibleCommands(),
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
      return (store.state.revisions[idx] ?? focusedRevision).changeId;
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


  onMount(() => {
    void (async () => {
      const [resolvedWorkspaceRoot, defaultRevset] = await Promise.all([
        client.loadWorkspaceRoot().catch(() => null),
        client.loadDefaultRevset(),
      ]);
      setWorkspaceRoot(resolvedWorkspaceRoot);
      const savedRevset = resolvedWorkspaceRoot
        ? await new HistoryStore(resolvedWorkspaceRoot).loadSetting("active-revset")
        : "";
      const initialRevset = savedRevset || defaultRevset;
      if (initialRevset) {
        store.actions.setRevsetQuery(initialRevset);
      }
      await refreshRepository(initialRevset || undefined);
    })();
  });

  return (
    <Show when={ready()}>
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={config.colorScheme.semanticColors.chromeFillOne}
    >
      <CommandBar
        store={store}
        config={config}
        workspaceRoot={workspaceRoot()}
        commandText={commandText()}
        commandSegments={commandSegments()}
        onSubmit={(value) => {
          store.actions.setCommandBarText(value);
          void executeCurrentCommand(value, { recordHistory: true });
        }}
      />
      <scrollbox
        ref={logViewport}
        width="100%"
        flexGrow={1}
        scrollY
        scrollbarOptions={{
          trackOptions: {
            backgroundColor: config.colorScheme.semanticColors.chromeFillThree,
            foregroundColor: config.colorScheme.semanticColors.chromeBorderFocus,
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
                previousRevisionId={store.state.revisions[index() - 1]?.changeId ?? null}
                nextRevisionId={store.state.revisions[index() + 1]?.changeId ?? null}
                config={config}
                focusedRevisionId={getFocusedRevision(store.state)?.changeId ?? null}
                selectedRevisionIds={getSelectedRevisionIds(store.state)}
                expandedRevisionId={getExpandedRevision(store.state)?.changeId ?? null}
                commandTargetId={getCommandTargetRevisionId(store.state)}
              />
            )}
          </For>
        </box>
      </scrollbox>
      <Show when={store.state.focusMode !== "revset"}>
        <StatusArea
          events={visibleEvents()}
          shortcutSummary={shortcutSummary()}
          shortcutGrid={shortcutGrid()}
          expanded={store.state.shortcutPanelExpanded}
          currentModeLabel={shortcutModeLabel(store.state.focusMode)}
          panelHeight={shortcutPanelHeight()}
          toggleHint={canToggleShortcutPanel() ? "? close" : null}
          config={config}
        />
      </Show>
      <Show when={store.state.focusMode === "revset"}>
        <RevsetInput
          revsetQuery={store.state.revsetQuery}
          client={client}
          config={config}
          workspaceRoot={workspaceRoot()}
          onApply={async (query) => {
            if (workspaceRoot()) {
              await new HistoryStore(workspaceRoot()!).record("revset-history", query);
              await new HistoryStore(workspaceRoot()!).saveSetting("active-revset", query);
            }
            store.actions.setRevsetQuery(query);
            store.actions.closeRevsetInput();
            void refreshRepository(query || undefined);
          }}
          onCancel={() => {
            store.actions.closeRevsetInput();
          }}
        />
      </Show>
      <MessageOverlay
        messages={store.state.statusMessages}
        loading={store.state.loading}
        config={config}
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

    store.actions.setLoading(true);

    try {
      if (options?.recordHistory && workspaceRoot()) {
        await new HistoryStore(workspaceRoot()!).record("command-history", commandTextValue);
      }
      const resultMessage = await client.executeCommand(commandTextValue);
      store.actions.cancelCommand();
      store.actions.pushEvent(resultMessage, "success");
      await refreshRepository();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.pushEvent(message, "error");
      store.actions.setLoading(false);
    }
  }

  async function runJjCommand(commandText: string) {
    store.actions.setLoading(true);
    try {
      const resultMessage = await client.executeCommand(commandText);
      store.actions.cancelCommand();
      store.actions.pushEvent(resultMessage, "success");
      await refreshRepository();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.pushEvent(message, "error");
      store.actions.setLoading(false);
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
        afterRevision.changeId,
        beforeRevision?.changeId ?? null,
        20,
      );
      store.actions.expandElidedRevision(elidedIndex, revisions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.pushEvent(message, "error");
    }
  }

  async function refreshRepository(revset?: string) {
    store.actions.setLoading(true);
    try {
      await client.verifyRepository();
      const repositoryData = await client.loadRepository(undefined, revset || store.state.revsetQuery || undefined);
      store.actions.applyRepositoryData(repositoryData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.pushEvent(message, "error");
      store.actions.setLoading(false);
    }
  }
}

function CommandBar(props: {
  store: AppStore;
  config: ResolvedAppConfig;
  workspaceRoot: string | null;
  commandText: string;
  commandSegments: readonly CommandSegment[] | null;
  onSubmit: (value: string) => void;
}) {
  const { store, config } = props;
  const colors = config.colorScheme.semanticColors;
  const commandBarFocused = createMemo(() => store.state.focusMode === "command");
  const showSegments = () => props.commandSegments !== null && !commandBarFocused();
  const flow: AutocompleteFlow = "top-to-bottom";
  const [historyEntries, setHistoryEntries] = createSignal<string[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);

  createEffect(() => {
    const focused = commandBarFocused();
    const workspaceRoot = props.workspaceRoot;

    if (!focused || !workspaceRoot) {
      setSelectedIndex(null);
      return;
    }

    void new HistoryStore(workspaceRoot).load("command-history").then(setHistoryEntries);
  });

  createEffect(() => {
    props.commandText;
    setSelectedIndex(null);
  });

  const filteredHistory = createMemo(() => {
    if (!commandBarFocused() || props.commandSegments !== null) {
      return [];
    }

    return matchHistoryEntries(props.commandText, historyEntries());
  });

  const autocompleteItems = createMemo<AutocompleteListItem[]>(() =>
    filteredHistory().map((entry) => ({
      id: entry,
      text: entry,
    }))
  );
  const autocompleteHeight = createMemo(() => Math.min(autocompleteItems().length, 10));

  useKeyboard((event) => {
    if (event.eventType === "release" || !commandBarFocused() || props.commandSegments !== null) {
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
    <box
      width="100%"
      height={3 + autocompleteHeight()}
      flexDirection="column"
    >
      <box
        width="100%"
        height={3}
        backgroundColor={
          commandBarFocused()
            ? colors.chromeFillTwo
            : colors.chromeFillOne
        }
        flexDirection="column"
      >
        <box width="100%" height={1} />
        <box
          width="100%"
          flexDirection="row"
          backgroundColor={
            commandBarFocused()
              ? colors.chromeFillTwo
              : colors.chromeFillOne
          }
        >
          <box width={4} flexDirection="row" paddingLeft={1}>
            <text fg={commandBarFocused() ? colors.textPrimary : colors.textTertiary}>jj </text>
          </box>
          {showSegments() ? (
            <box flexGrow={1} flexDirection="row">
              <For each={props.commandSegments!}>
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
          ) : (
            <input
              ref={(el: any) => el.editorView.setScrollMargin(0)}
              flexGrow={1}
              value={props.commandText}
              placeholder={commandBarFocused() ? "subcommand" : "subcommand (':' to type)"}
              focused={commandBarFocused()}
              textColor={colors.textPrimary}
              focusedTextColor={colors.textPrimary}
              placeholderColor={commandBarFocused() ? colors.textQuaternary : colors.textTertiary}
              cursorColor={colors.chromeBorderFocus}
              onInput={(value) => {
                store.actions.setCommandBarText(value);
              }}
              onSubmit={props.onSubmit as any}
            />
          )}
        </box>
        <box width="100%" height={1} />
      </box>
      <Show when={autocompleteItems().length > 0}>
        <AutocompleteList
          items={autocompleteItems()}
          selectedIndex={selectedIndex()}
          flow={flow}
          config={config}
        />
      </Show>
    </box>
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
}) {
  const colors = () => props.config.colorScheme.semanticColors;
  const affectedIds = createMemo(() => getOperationAffectedRevisionIds(props.state));
  const isFocused = () => props.revision.changeId === props.focusedRevisionId;
  const isSelected = () => props.selectedRevisionIds.has(props.revision.changeId);
  const isExpanded = () => props.revision.changeId === props.expandedRevisionId;
  const anyExpanded = () => props.expandedRevisionId !== null;
  const isAffected = () => affectedIds().has(props.revision.changeId);
  const isCommandTarget = () => props.commandTargetId === props.revision.changeId;
  const rowState = createMemo(() =>
    getRevisionRowState(props.revision.changeId, props.focusedRevisionId, props.selectedRevisionIds) ?? "default",
  );
  const previousRowState = createMemo(() =>
    getRevisionRowState(props.previousRevisionId, props.focusedRevisionId, props.selectedRevisionIds),
  );
  const nextRowState = createMemo(() =>
    getRevisionRowState(props.nextRevisionId, props.focusedRevisionId, props.selectedRevisionIds),
  );
  const coreGraphWidth = createMemo(() =>
    measureCoreGraphWidth(props.revision.graphHead, props.revision.graphTail)
  );
  const previousCoreGraphWidth = createMemo(() => {
    const prev = props.index > 0 ? props.state.revisions[props.index - 1] : null;
    return prev ? measureCoreGraphWidth(prev.graphHead, prev.graphTail) : null;
  });
  const nextCoreGraphWidth = createMemo(() => {
    const next = props.state.revisions[props.index + 1] ?? null;
    return next ? measureCoreGraphWidth(next.graphHead, next.graphTail) : null;
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
  const borderPolicy = createMemo(() => getRevisionBorderPolicy({
    rowState: effectiveRowState(),
    previousRowState: previousEffectiveRowState(),
    nextRowState: nextEffectiveRowState(),
    currentGraphWidth: coreGraphWidth(),
    previousGraphWidth: previousCoreGraphWidth(),
    nextGraphWidth: nextCoreGraphWidth(),
  }));
  const detailRowCount = () => isExpanded() ? Math.max(props.revision.files.length, 1) : 0;
  const headerLayout = createMemo(() =>
    buildRevisionHeaderLayout(props.revision, {
      condensed: props.state.condensedLayout,
      isCommandTarget: isCommandTarget(),
      badgeText: props.state.commandDraft?.config.badgeText ?? "onto",
    }),
  );
  const showCondensedHeader = () => headerLayout().headerRowCount === 1;
  const gutterPlan = createMemo(() => buildRevisionGutterPlan({
    graphHead: props.revision.graphHead,
    graphTail: props.revision.graphTail,
    detailRowCount: detailRowCount(),
    ownsTop: borderPolicy().ownsTop,
    ownsBottom: borderPolicy().ownsBottom,
    previousGraphBottom: (() => {
      const prev = props.index > 0 ? props.state.revisions[props.index - 1] : null;
      if (!prev) return null;
      return prev.graphTail.at(-1) ?? prev.graphHead;
    })(),
    hasNextRevision: props.index + 1 < props.state.revisions.length,
  }));
  const visibleGutterTail = createMemo(() => showCondensedHeader() ? [] : gutterPlan().tail);
  const effectiveGraphWidth = createMemo(() => measureGutterPlanWidth(gutterPlan()));
  const displayedTitleGraph = createMemo(() =>
    showCondensedHeader()
      ? buildCondensedGraphLine(props.revision.graphHead, props.revision.graphTail)
      : gutterPlan().title
  );
  const currentLeftCol = () => coreGraphWidth() + 1;
  const prevLeftCol = () => previousCoreGraphWidth() !== null ? previousCoreGraphWidth()! + 1 : null;
  const nextLeftCol = () => nextCoreGraphWidth() !== null ? nextCoreGraphWidth()! + 1 : null;
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
  const showExpandedTimestamp = () => !props.state.condensedLayout;

  return (
    <box
      id={`revision-${props.revision.changeId}`}
      width="100%"
      flexDirection="row"
      opacity={anyExpanded() && !isExpanded() ? 0.6 : 1}
    >
      <box width={effectiveGraphWidth()} flexDirection="column">
        {gutterPlan().topDivider !== null ? (
          <text fg={continuationGraphColor()}>
            {padRight(gutterPlan().topDivider!, effectiveGraphWidth())}
          </text>
        ) : null}
        <text fg={titleGraphColor()}>{padRight(displayedTitleGraph(), effectiveGraphWidth())}</text>
        <Show when={headerLayout().headerRowCount === 2 && props.revision.marker !== "elided"}>
          <text fg={continuationGraphColor()}>
            {padRight(gutterPlan().subtitle, effectiveGraphWidth())}
          </text>
        </Show>
        <For each={visibleGutterTail()}>
          {(graphLine) => (
            <text fg={continuationGraphColor()}>
              {padRight(graphLine, effectiveGraphWidth())}
            </text>
          )}
        </For>
        <For each={gutterPlan().detail}>
          {(graphLine) => (
            <text fg={continuationGraphColor()}>
              {padRight(graphLine, effectiveGraphWidth())}
            </text>
          )}
        </For>
        {gutterPlan().bottomDivider !== null ? (
          <text fg={continuationGraphColor()}>
            {padRight(gutterPlan().bottomDivider!, effectiveGraphWidth())}
          </text>
        ) : null}
      </box>
      <box width={1} />
      <box
        flexGrow={1}
        flexDirection="column"
        paddingRight={1}
        backgroundColor={
          isSelected()
            ? colors().rowSelectedFill
            : isFocused()
            ? colors().rowFocusedFill
            : isAffected()
              ? colors().rowAffectedFill
              : undefined
        }
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
            when={showCondensedHeader()}
            fallback={
              <>
                <box width="100%" flexDirection="row" gap={1}>
                  <RevisionChangeId
                    revision={props.revision}
                    rowState={effectiveRowState()}
                    colors={colors()}
                    showTimestamp={showExpandedTimestamp()}
                  />
                  {headerLayout().commandTarget ? (
                    <CommandTargetChip
                      text={headerLayout().commandTarget!.text}
                      colors={colors()}
                    />
                  ) : null}
                  <box flexGrow={1} />
                  <RevisionSideChips chips={headerLayout().sideChips} colors={colors()} />
                </box>
                <box width="100%" flexDirection="row">
                  <text fg={descriptionColor()} truncate>
                    {props.revision.description}
                  </text>
                </box>
              </>
            }
          >
            <box
              width="100%"
              height={headerLayout().contentHeight}
              overflow={headerLayout().clipOverflow ? "hidden" : undefined}
              position="relative"
            >
              <box width="100%" height={1} flexDirection="row">
                <RevisionChangeId
                  revision={props.revision}
                  rowState={effectiveRowState()}
                  colors={colors()}
                  showTimestamp={showExpandedTimestamp()}
                />
                <box width={1} />
                <box flexGrow={1} minWidth={0} height={1} overflow="hidden">
                  <text
                    fg={descriptionColor()}
                    wrapMode="none"
                    truncate
                  >
                    {props.revision.description}
                  </text>
                </box>
                <Show when={headerLayout().sideChips.length > 0}>
                  <box width={1} />
                </Show>
                <RevisionSideChips chips={headerLayout().sideChips} colors={colors()} />
              </box>
              {headerLayout().commandTarget?.placement === "overlay" ? (
                <text
                  position="absolute"
                  left={headerLayout().commandTarget!.leftOffset}
                  top={0}
                  zIndex={1}
                  fg={colors().chromeFillOne}
                  bg={colors().chromeBorderFocus}
                >
                  {` ${headerLayout().commandTarget!.text} `}
                </text>
              ) : null}
            </box>
          </Show>
          <For each={visibleGutterTail()}>
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
      {borderPolicy().ownsTop && prevLeftCol() !== null && currentLeftCol() < prevLeftCol()! ? (
        <text position="absolute" left={prevLeftCol()!} top={0} zIndex={1} fg={borderColor()}>┴</text>
      ) : null}
      {borderPolicy().ownsTop && prevLeftCol() !== null && currentLeftCol() > prevLeftCol()! ? (
        <text position="absolute" left={prevLeftCol()!} top={0} zIndex={1} fg={borderColor()}>
          {"└" + "─".repeat(currentLeftCol() - prevLeftCol()! - 1)}
        </text>
      ) : null}
      {borderPolicy().ownsBottom && nextLeftCol() !== null && currentLeftCol() < nextLeftCol()! ? (
        <text position="absolute" left={nextLeftCol()!} bottom={0} zIndex={1} fg={borderColor()}>┬</text>
      ) : null}
      {borderPolicy().ownsBottom && nextLeftCol() !== null && currentLeftCol() > nextLeftCol()! ? (
        <text position="absolute" left={nextLeftCol()!} bottom={0} zIndex={1} fg={borderColor()}>
          {"┌" + "─".repeat(currentLeftCol() - nextLeftCol()! - 1)}
        </text>
      ) : null}
    </box>
  );
}

function RevisionChangeId(props: {
  revision: Pick<RevisionSummary, "changeId" | "changeIdPrefixLength" | "localTimestamp">;
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

function RevisionSideChips(props: {
  chips: readonly RevisionSideChip[];
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
}) {
  return (
    <box flexDirection="row" flexShrink={0} gap={1}>
      <For each={props.chips}>
        {(chip) => (
          <text
            fg={chip.kind === "bookmark" ? props.colors.workspaceTagText : props.colors.bookmarkTagText}
            bg={chip.kind === "bookmark" ? props.colors.workspaceTagFill : props.colors.bookmarkTagFill}
          >
            {` ${chip.text} `}
          </text>
        )}
      </For>
    </box>
  );
}

function ChangedFiles(props: {
  state: AppStore["state"];
  revision: RevisionSummary;
  config: ResolvedAppConfig;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const placeholderText = createMemo(() => getChangedFilesPlaceholderText(props.revision));

  return (
    <box width="100%" flexDirection="column">
      {placeholderText() ? (
        <text fg={colors.textTertiary}>{placeholderText()}</text>
      ) : (
        <For each={props.revision.files}>
          {(file, index) => {
            const rowState = createMemo(() =>
              getChangedFileRowState(props.state, props.revision.changeId, index(), file.path)
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
                <text fg={colors.fileStatusAccent}>{file.status}</text>
                <text fg={rowState().selected || rowState().focused ? colors.textPrimary : colors.textSecondary} truncate>
                  {file.path}
                </text>
              </box>
            );
          }}
        </For>
      )}
    </box>
  );
}

function StatusArea(props: {
  events: readonly AppStore["state"]["eventLog"][number][];
  shortcutSummary: string;
  shortcutGrid: ShortcutGrid;
  expanded: boolean;
  currentModeLabel: string;
  panelHeight: number;
  toggleHint: string | null;
  config: ResolvedAppConfig;
}) {
  const { events, config } = props;
  const colors = config.colorScheme.semanticColors;
  const panelBodyHeight = () =>
    Math.max(1, Math.min(props.shortcutGrid.rows.length, Math.max(1, props.panelHeight - 3)));
  return (
    <Show
      when={props.expanded}
      fallback={
        <box
          width="100%"
          border
          borderStyle="single"
          borderColor={colors.chromeBorderIdle}
          backgroundColor={colors.chromeFillOne}
          paddingX={1}
          flexDirection="column"
        >
          <For each={events}>
            {(event) => (
              <box width="100%">
                <text fg={statusColor(event.level, colors)} truncate>
                  {`${new Date(event.createdAt).toLocaleTimeString()} ${event.text}`}
                </text>
              </box>
            )}
          </For>
          <box width="100%" backgroundColor={colors.chromeFillOne}>
            <text fg={colors.textTertiary} truncate>
              {props.shortcutSummary}
            </text>
          </box>
        </box>
      }
    >
        <box
          width="100%"
          position="absolute"
          left={0}
          bottom={0}
        zIndex={5}
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
          <Show when={props.toggleHint !== null}>
            <text fg={colors.textTertiary}>{props.toggleHint}</text>
          </Show>
        </box>
        <box width="100%" height={1} backgroundColor={colors.chromeFillTwo} />
        <scrollbox
          width="100%"
          height={panelBodyHeight()}
          scrollY
          backgroundColor={colors.chromeFillTwo}
          scrollbarOptions={{
            trackOptions: {
              backgroundColor: colors.chromeFillThree,
              foregroundColor: colors.chromeBorderFocus,
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

function RevsetInput(props: {
  revsetQuery: string;
  client: JjClient;
  config: ResolvedAppConfig;
  workspaceRoot: string | null;
  onApply: (query: string) => void | Promise<void>;
  onCancel: () => void;
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
  const autocompleteHeight = createMemo(() => Math.min(suggestions().length, 10));

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
    <box
      width="100%"
      height={3 + autocompleteHeight()}
      flexDirection="column"
    >
      <Show when={suggestions().length > 0}>
        <AutocompleteList
          items={suggestions()}
          selectedIndex={selectedIndex()}
          flow={flow}
          config={props.config}
        />
      </Show>
      <box
        width="100%"
        height={3}
        paddingX={1}
        border
        borderStyle="single"
        borderColor={colors.chromeBorderFocus}
        backgroundColor={colors.chromeFillTwo}
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
      </box>
    </box>
  );
}

function MessageOverlay(props: {
  messages: readonly StatusMessage[];
  loading: boolean;
  config: ResolvedAppConfig;
  onDismiss: (id?: string) => void;
}) {
  const visible = () => props.messages.length > 0 || props.loading;

  return (
    <Show when={visible()}>
      <box
        position="absolute"
        bottom={0}
        left={0}
        width="100%"
        zIndex={10}
        flexDirection="column-reverse"
        gap={1}
      >
        <Show when={props.loading}>
          <LoadingOverlay config={props.config} />
        </Show>
        <Show when={props.messages.length > 0}>
          <box width="100%" flexDirection="column-reverse" gap={1}>
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
    const timer = setTimeout(
      props.onDismiss,
      getStatusMessageDismissDelay(props.message.createdAt),
    );
    onCleanup(() => clearTimeout(timer));
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
      <text fg={statusColor(props.message.level, colors)} wrapMode="word">
        {props.message.text}
      </text>
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

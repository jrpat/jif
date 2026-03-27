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
  buildRevisionGutterPlan,
  measureCoreGraphWidth,
  measureGutterPlanWidth,
} from "./revisionGutter.ts";
import { buildRevisionHeaderLayout, type RevisionSideChip } from "./revisionLayout.ts";
import { scrollToKeepChildVisible } from "./scroll.ts";

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
    renderer.on(CliRenderEvents.THEME_MODE, handleThemeMode);
    onCleanup(() => renderer.off(CliRenderEvents.THEME_MODE, handleThemeMode));
  });

  const controller: CommandController = {
    moveFocus(delta: number) {
      store.actions.moveFocus(delta);
    },
    openFocusedRevision() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.openFocusedRevision();
      if (revision.files.length > 0) {
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

      if (state.statusMessage !== null) {
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
  const visibleEvents = createMemo(() => store.state.eventLog.slice(-3).reverse());

  useKeyboard((event) => {
    if (event.eventType === "release" || event.ctrl || event.meta || event.option) {
      return;
    }

    const state = store.snapshot();
    const normalizedKey = normalizeKey(event);
    if (normalizedKey === null) {
      return;
    }

    if (normalizedKey === "escape") {
      event.preventDefault();
      controller.cancelOrBlur();
      return;
    }

    if (state.focusMode === "command" || state.focusMode === "revset") {
      return;
    }

    if (normalizedKey === "enter") {
      event.preventDefault();
      controller.confirm();
      return;
    }

    const command = visibleCommands().find((definition) => definition.keys.includes(normalizedKey));
    if (!command) {
      return;
    }

    event.preventDefault();
    command.run(controller);
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
      if (defaultRevset) {
        store.actions.setRevsetQuery(defaultRevset);
      }
      await refreshRepository(defaultRevset || undefined);
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
          helpText={visibleCommands()
            .map((command) => `${command.canonicalKeys.join("/")} ${command.title.toLowerCase()}`)
            .join("   ")}
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
        message={store.state.statusMessage}
        loading={store.state.loading}
        config={config}
        onDismiss={() => store.actions.dismissStatusMessage()}
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
  const { state, revision, config } = props;
  const colors = () => config.colorScheme.semanticColors;
  const affectedIds = createMemo(() => getOperationAffectedRevisionIds(state));
  const isFocused = () => revision.changeId === props.focusedRevisionId;
  const isSelected = () => props.selectedRevisionIds.has(revision.changeId);
  const isExpanded = () => revision.changeId === props.expandedRevisionId;
  const anyExpanded = () => props.expandedRevisionId !== null;
  const isAffected = () => affectedIds().has(revision.changeId);
  const isCommandTarget = () => props.commandTargetId === revision.changeId;
  const rowState = createMemo(() =>
    getRevisionRowState(revision.changeId, props.focusedRevisionId, props.selectedRevisionIds) ?? "default",
  );
  const previousRowState = createMemo(() =>
    getRevisionRowState(props.previousRevisionId, props.focusedRevisionId, props.selectedRevisionIds),
  );
  const nextRowState = createMemo(() =>
    getRevisionRowState(props.nextRevisionId, props.focusedRevisionId, props.selectedRevisionIds),
  );
  const coreGraphWidth = createMemo(() =>
    measureCoreGraphWidth(revision.graphHead, revision.graphTail)
  );
  const previousCoreGraphWidth = createMemo(() => {
    const prev = props.index > 0 ? state.revisions[props.index - 1] : null;
    return prev ? measureCoreGraphWidth(prev.graphHead, prev.graphTail) : null;
  });
  const nextCoreGraphWidth = createMemo(() => {
    const next = state.revisions[props.index + 1] ?? null;
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
  const detailRowCount = () => isExpanded() ? Math.max(revision.files.length, 1) : 0;
  const headerLayout = createMemo(() =>
    buildRevisionHeaderLayout(revision, {
      condensed: state.condensedLayout,
      isCommandTarget: isCommandTarget(),
      badgeText: state.commandDraft?.config.badgeText ?? "onto",
    }),
  );
  const showCondensedHeader = () => headerLayout().headerRowCount === 1;
  const gutterPlan = createMemo(() => buildRevisionGutterPlan({
    graphHead: revision.graphHead,
    graphTail: revision.graphTail,
    detailRowCount: detailRowCount(),
    ownsTop: borderPolicy().ownsTop,
    ownsBottom: borderPolicy().ownsBottom,
    previousGraphBottom: (() => {
      const prev = props.index > 0 ? state.revisions[props.index - 1] : null;
      if (!prev) return null;
      return prev.graphTail.at(-1) ?? prev.graphHead;
    })(),
    hasNextRevision: props.index + 1 < state.revisions.length,
  }));
  const visibleGutterTail = createMemo(() => showCondensedHeader() ? [] : gutterPlan().tail);
  const effectiveGraphWidth = createMemo(() => measureGutterPlanWidth(gutterPlan()));
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
  const titleGraphColor = createMemo(() => markerColor(revision, colors()));
  const continuationGraphColor = createMemo(() => colors().textTertiary);

  return (
    <box
      id={`revision-${revision.changeId}`}
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
        <text fg={titleGraphColor()}>{padRight(gutterPlan().title, effectiveGraphWidth())}</text>
        <Show when={headerLayout().headerRowCount === 2}>
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
          when={showCondensedHeader()}
          fallback={
            <>
              <box width="100%" flexDirection="row" gap={1}>
                <RevisionChangeId
                  revision={revision}
                  focused={isFocused()}
                  selected={isSelected()}
                  colors={colors()}
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
                <text fg={isSelected() || isFocused() ? colors().textPrimary : colors().textSecondary} truncate>
                  {revision.description}
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
                revision={revision}
                focused={isFocused()}
                selected={isSelected()}
                colors={colors()}
              />
              <box width={1} />
              <box flexGrow={1} minWidth={0} height={1} overflow="hidden">
                <text
                  fg={isSelected() || isFocused() ? colors().textPrimary : colors().textSecondary}
                  wrapMode="none"
                  truncate
                >
                  {revision.description}
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
            state={state}
            revision={revision}
            config={config}
          />
        ) : null}
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
  revision: Pick<RevisionSummary, "changeId" | "changeIdPrefixLength">;
  focused: boolean;
  selected: boolean;
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
}) {
  return (
    <box flexDirection="row" flexShrink={0}>
      <text
        fg={props.selected ? props.colors.rowSelectedAccent : props.focused ? props.colors.chromeBorderFocus : props.colors.revsetPrefix}
        attributes={TextAttributes.BOLD}
      >
        {props.revision.changeId.slice(0, props.revision.changeIdPrefixLength)}
      </text>
      <text fg={props.selected ? props.colors.rowSelectedAccent : props.focused ? props.colors.chromeBorderFocus : props.colors.textTertiary}>
        {props.revision.changeId.slice(props.revision.changeIdPrefixLength)}
      </text>
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
  const { state, revision, config } = props;
  const colors = config.colorScheme.semanticColors;

  return (
    <box width="100%" flexDirection="column">
      {revision.files.length === 0 ? (
        <text fg={colors.textTertiary}>Loading changed files...</text>
      ) : (
        <For each={revision.files}>
          {(file, index) => {
            const focused =
              state.focusMode === "files" &&
              state.expandedRevisionId === revision.changeId &&
              state.focusedFileIndex === index();
            const selected = state.selectedFilePaths.includes(file.path);

            return (
              <box
                width="100%"
                flexDirection="row"
                gap={1}
                backgroundColor={
                  selected
                    ? colors.rowSelectedFill
                    : focused
                      ? colors.rowFocusedFill
                      : undefined
                }
              >
                <text fg={selected ? colors.rowSelectedAccent : focused ? colors.fileFocusMarker : colors.textTertiary}>
                  {selected ? "*" : focused ? ">" : " "}
                </text>
                <text fg={colors.fileStatusAccent}>{file.status}</text>
                <text fg={selected || focused ? colors.textPrimary : colors.textSecondary} truncate>
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
  helpText: string;
  config: ResolvedAppConfig;
}) {
  const { events, helpText, config } = props;
  const colors = config.colorScheme.semanticColors;

  return (
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
          {helpText}
        </text>
      </box>
    </box>
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
  message: StatusMessage | null;
  loading: boolean;
  config: ResolvedAppConfig;
  onDismiss: () => void;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const level = () => props.message?.level ?? "info";
  const visible = () => props.message !== null || props.loading;
  const text = () =>
    props.message !== null
      ? props.message.text
      : "Refreshing repository state...";

  createEffect(() => {
    if (props.message !== null) {
      const timer = setTimeout(() => props.onDismiss(), 5000);
      onCleanup(() => clearTimeout(timer));
    }
  });

  return (
    <Show when={visible()}>
      <scrollbox
        position="absolute"
        bottom={0}
        left={0}
        width="100%"
        maxHeight={10}
        zIndex={10}
        backgroundColor={colors.chromeFillOne}
        border
        borderStyle="single"
        borderColor={statusColor(level(), colors)}
        paddingX={1}
        scrollY
        scrollbarOptions={{
          trackOptions: {
            backgroundColor: colors.chromeFillThree,
            foregroundColor: colors.chromeBorderFocus,
          },
        }}
      >
        <text fg={statusColor(level(), colors)} wrapMode="word">
          {text()}
        </text>
      </scrollbox>
    </Show>
  );
}
function normalizeKey(event: { name: string; sequence: string }): string | null {
  if (event.name === "return") {
    return "enter";
  }

  if (event.sequence.length === 1 && event.sequence >= " ") {
    return event.sequence;
  }

  return event.name || null;
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

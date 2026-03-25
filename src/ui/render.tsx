import { TextAttributes, CliRenderEvents, type ScrollBoxRenderable } from "@opentui/core";
import { For, Show, createEffect, createMemo, createRenderEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useKeyboard, useRenderer } from "@opentui/solid";
import { getVisibleCommands, type CommandController } from "../commands/definitions.ts";
import { resolveAppConfig, type AppConfig, type ResolvedAppConfig } from "../config/index.ts";
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
import type { RevisionSummary } from "../domain/types.ts";
import {
  getRevisionBorderPolicy,
  type RevisionRowState,
} from "./revisionBorders.ts";
import {
  buildRevisionGutterPlan,
  measureCoreGraphWidth,
  measureGutterPlanWidth,
} from "./revisionGutter.ts";
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

      if (state.error !== null || state.eventLog.some((e) => e.level === "error")) {
        store.actions.dismissOldestError();
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
    undo() {
      void runJjCommand("undo");
    },
    redo() {
      void runJjCommand("redo");
    },
    focusWorkingCopy() {
      store.actions.focusWorkingCopy();
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

    if (state.focusMode === "command") {
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

  createEffect(() => {
    const message = store.state.statusMessage;
    if (message?.level === "success") {
      const timer = setTimeout(() => store.actions.clearStatusMessage(), 5000);
      onCleanup(() => clearTimeout(timer));
    }
  });

  onMount(() => {
    void refreshRepository();
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
        commandText={commandText()}
        commandSegments={commandSegments()}
        onSubmit={(value) => {
          store.actions.setCommandBarText(value);
          void executeCurrentCommand(value);
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
      <StatusArea
        state={store.state}
        events={visibleEvents()}
        helpText={visibleCommands()
          .map((command) => `${command.canonicalKeys.join("/")} ${command.title.toLowerCase()}`)
          .join("   ")}
        config={config}
      />
    </box>
    </Show>
  );

  async function executeCurrentCommand(commandOverride?: string) {
    const state = store.snapshot();
    const commandTextValue = (commandOverride ?? getDisplayedCommandText(state)).trim();
    if (!commandCanExecute(state) || commandTextValue.length === 0) {
      return;
    }

    store.actions.setLoading(true);

    try {
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

  async function refreshRepository() {
    store.actions.setLoading(true);
    try {
      await client.verifyRepository();
      const repositoryData = await client.loadRepository();
      store.actions.applyRepositoryData(repositoryData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.setError(message);
      store.actions.pushEvent(message, "error");
    }
  }
}

function CommandBar(props: {
  store: AppStore;
  config: ResolvedAppConfig;
  commandText: string;
  commandSegments: readonly CommandSegment[] | null;
  onSubmit: (value: string) => void;
}) {
  const { store, config } = props;
  const colors = config.colorScheme.semanticColors;
  const commandBarFocused = createMemo(() => store.state.focusMode === "command");
  const showSegments = () => props.commandSegments !== null && !commandBarFocused();

  return (
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
            placeholder="subcommand (':' to type)"
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
  );
}

function RevisionItem(props: {
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
  const borderPolicy = createMemo(() => getRevisionBorderPolicy({
    rowState: rowState(),
    previousRowState: previousRowState(),
    nextRowState: nextRowState(),
    currentGraphWidth: coreGraphWidth(),
    previousGraphWidth: previousCoreGraphWidth(),
    nextGraphWidth: nextCoreGraphWidth(),
  }));
  const detailRowCount = () => isExpanded() ? Math.max(revision.files.length, 1) : 0;
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
  const effectiveGraphWidth = createMemo(() => measureGutterPlanWidth(gutterPlan()));
  const currentLeftCol = () => coreGraphWidth() + 1;
  const prevLeftCol = () => previousCoreGraphWidth() !== null ? previousCoreGraphWidth()! + 1 : null;
  const nextLeftCol = () => nextCoreGraphWidth() !== null ? nextCoreGraphWidth()! + 1 : null;
  const borderColor = createMemo(() =>
    rowState() === "selected"
      ? colors().rowSelectedAccent
      : rowState() === "focused"
        ? colors().chromeBorderFocus
        : isCommandTarget()
        ? colors().rowCommandTargetBorder
        : colors().chromeBorderIdle
  );
  const titleGraphColor = createMemo(() =>
    isSelected()
      ? colors().rowSelectedAccent
      : isFocused()
        ? colors().chromeBorderFocus
        : markerColor(revision, colors())
  );
  const continuationGraphColor = createMemo(() =>
    isSelected()
      ? colors().rowSelectedAccent
      : isFocused()
        ? colors().chromeBorderFocus
        : colors().textTertiary
  );

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
        <text fg={continuationGraphColor()}>
          {padRight(gutterPlan().subtitle, effectiveGraphWidth())}
        </text>
        <For each={gutterPlan().tail}>
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
        <box width="100%" flexDirection="row" gap={1}>
          <box flexDirection="row">
            <text fg={isSelected() ? colors().rowSelectedAccent : isFocused() ? colors().chromeBorderFocus : colors().revsetPrefix} attributes={TextAttributes.BOLD}>
              {revision.changeId.slice(0, revision.changeIdPrefixLength)}
            </text>
            <text fg={isSelected() ? colors().rowSelectedAccent : isFocused() ? colors().chromeBorderFocus : colors().textTertiary}>
              {revision.changeId.slice(revision.changeIdPrefixLength)}
            </text>
          </box>
          {isCommandTarget() ? (
            <text fg={colors().chromeFillOne} bg={colors().chromeBorderFocus}>
              {` ${state.commandDraft?.config.badgeText ?? "onto"} `}
            </text>
          ) : null}
          <box flexGrow={1} />
          <For each={revision.bookmarks}>
            {(bookmark) => (
              <text fg={colors().workspaceTagText} bg={colors().workspaceTagFill}>
                {` ${bookmark} `}
              </text>
            )}
          </For>
          <For each={revision.workspaces}>
            {(workspace) => (
              <text fg={colors().bookmarkTagText} bg={colors().bookmarkTagFill}>
                {` ${workspace} `}
              </text>
            )}
          </For>
        </box>
        <box width="100%" flexDirection="row">
          <text fg={isSelected() || isFocused() ? colors().textPrimary : colors().textSecondary} truncate>
            {revision.description}
          </text>
        </box>
        <For each={gutterPlan().tail}>
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
  state: AppStore["state"];
  events: readonly AppStore["state"]["eventLog"][number][];
  helpText: string;
  config: ResolvedAppConfig;
}) {
  const { state, events, helpText, config } = props;
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
      {(state.error || state.loading || state.statusMessage) ? (
        <box width="100%" backgroundColor={colors.chromeFillOne}>
          <text
            fg={statusColor(
              state.error ? "error" : state.statusMessage?.level ?? "info",
              colors,
            )}
            truncate
          >
            {state.error
              ? state.error
              : state.loading
                ? "Refreshing repository state..."
                : state.statusMessage!.text}
          </text>
        </box>
      ) : null}
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

function normalizeKey(event: { name: string; sequence: string }): string | null {
  if (event.name === "return") {
    return "enter";
  }

  if (event.sequence.length === 1 && event.sequence >= " ") {
    return event.sequence;
  }

  return event.name || null;
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


import type { ScrollBoxRenderable } from "@opentui/core";
import { For, createEffect, createMemo, onMount } from "solid-js";
import { useKeyboard, useRenderer } from "@opentui/solid";
import { getVisibleCommands, type CommandController } from "../commands/definitions.ts";
import type { ResolvedAppConfig } from "../config/index.ts";
import type { AppStore } from "../state/appStore.ts";
import {
  commandCanExecute,
  getCurrentRebaseTargetRevisionId,
  getDisplayedCommandText,
  getExpandedRevision,
  getFocusedRevision,
  getOperationAffectedRevisionIds,
  getSelectedRevisionId,
} from "../state/store.ts";
import type { JjClient } from "../jj/client.ts";
import type { RevisionSummary } from "../domain/types.ts";
import {
  getRevisionBorderPolicy,
  type RevisionRowState,
} from "./revisionBorders.ts";
import {
  buildRevisionGutterPlan,
  measureGraphLineWidth,
} from "./revisionGutter.ts";

export function JifView(props: {
  store: AppStore;
  client: JjClient;
  config: ResolvedAppConfig;
}) {
  const { store, client, config } = props;
  const appBackground =
    config.colorScheme.mode === "light" ? "#f5f7fa" : "#0f1419";
  const renderer = useRenderer();
  let logViewport: ScrollBoxRenderable | undefined;

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
      store.actions.cancelCommand();
    },
    confirm() {
      void executeCurrentCommand();
    },
    focusCommandBar() {
      store.actions.focusCommandBar();
    },
    startRebase() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(revision.changeId);
          store.actions.startRebaseCommand(descendants);
          store.actions.pushEvent(`Composing rebase for ${revision.changeId}`, "info");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          store.actions.pushEvent(message, "error");
        }
      })();
    },
    toggleRebaseDescendants() {
      const draft = store.snapshot().commandDraft;
      if (draft?.kind !== "rebase") {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(draft.sourceRevisionId);
          store.actions.toggleRebaseDescendants(descendants);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          store.actions.pushEvent(message, "error");
        }
      })();
    },
  };

  const commandText = createMemo(() => getDisplayedCommandText(store.state));
  const visibleCommands = createMemo(() => getVisibleCommands(store.state));
  const visibleEvents = createMemo(() => store.state.eventLog.slice(-3).reverse());
  const graphWidth = createMemo(() =>
    store.state.revisions.reduce((maxWidth, revision) => {
      const widths = [
        measureGraphLineWidth(revision.graphHead),
        ...revision.graphTail.map(measureGraphLineWidth),
      ];
      return Math.max(maxWidth, ...widths);
    }, 1)
  );

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

  createEffect(() => {
    const focusedRevision = getFocusedRevision(store.state);
    if (!focusedRevision || !logViewport) {
      return;
    }

    const focusedIndex = store.state.focusedRevisionIndex;
    const targetIndex = Math.min(focusedIndex + config.log.scrollMargin, store.state.revisions.length - 1);
    const targetRevision = store.state.revisions[targetIndex];

    queueMicrotask(() => {
      logViewport?.scrollChildIntoView(`revision-${(targetRevision ?? focusedRevision).changeId}`);
    });
  });

  onMount(() => {
    void refreshRepository();
  });

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={appBackground}
    >
      <CommandBar
        store={store}
        config={config}
        commandText={commandText()}
        onSubmit={(value) => {
          store.actions.setCommandBarText(value);
          void executeCurrentCommand(value);
        }}
      />
      <box width="100%" height={1} backgroundColor={appBackground} />
      <scrollbox
        ref={logViewport}
        width="100%"
        flexGrow={1}
        scrollY
        scrollbarOptions={{
          trackOptions: {
            backgroundColor: config.colorScheme.mode === "light" ? "#d5dde5" : "#1b2430",
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
                graphWidth={graphWidth()}
                config={config}
                focusedRevisionId={getFocusedRevision(store.state)?.changeId ?? null}
                selectedRevisionId={getSelectedRevisionId(store.state)}
                expandedRevisionId={getExpandedRevision(store.state)?.changeId ?? null}
                commandTargetId={getCurrentRebaseTargetRevisionId(store.state)}
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
  onSubmit: (value: string) => void;
}) {
  const { store, config } = props;
  const colors = config.colorScheme.semanticColors;

  return (
    <box
      width="100%"
      height={2}
      backgroundColor={
        store.state.focusMode === "command"
          ? colors.chromeFillTwo
          : colors.chromeFillOne
      }
      flexDirection="column"
    >
      <box width="100%" height={1} />
      <box width="100%" flexDirection="row" gap={1} paddingLeft={1}>
        <text fg={colors.textMuted}>jj</text>
        <input
          width="100%"
          value={props.commandText}
          placeholder="Type a jj subcommand"
          focused={store.state.focusMode === "command"}
          backgroundColor={colors.chromeFillTwo}
          focusedBackgroundColor={colors.chromeFillThree}
          textColor={colors.textPrimary}
          focusedTextColor={colors.textPrimary}
          placeholderColor={colors.textMuted}
          cursorColor={colors.chromeBorderFocus}
          onInput={(value) => {
            store.actions.setCommandBarText(value);
          }}
          onSubmit={props.onSubmit as any}
        />
      </box>
    </box>
  );
}

function RevisionItem(props: {
  state: AppStore["state"];
  revision: RevisionSummary;
  index: number;
  previousRevisionId: string | null;
  nextRevisionId: string | null;
  graphWidth: number;
  config: ResolvedAppConfig;
  focusedRevisionId: string | null;
  selectedRevisionId: string | null;
  expandedRevisionId: string | null;
  commandTargetId: string | null;
}) {
  const {
    state,
    revision,
    graphWidth,
    config,
    focusedRevisionId,
    selectedRevisionId,
    expandedRevisionId,
    commandTargetId,
  } = props;
  const colors = config.colorScheme.semanticColors;
  const affectedIds = getOperationAffectedRevisionIds(state);
  const isFocused = revision.changeId === focusedRevisionId;
  const isSelected = revision.changeId === selectedRevisionId;
  const isExpanded = revision.changeId === expandedRevisionId;
  const anyExpanded = expandedRevisionId !== null;
  const isAffected = affectedIds.has(revision.changeId);
  const isCommandTarget = commandTargetId === revision.changeId;
  const rowState =
    getRevisionRowState(revision.changeId, focusedRevisionId, selectedRevisionId) ?? "default";
  const previousRowState = getRevisionRowState(
    props.previousRevisionId,
    focusedRevisionId,
    selectedRevisionId,
  );
  const nextRowState = getRevisionRowState(
    props.nextRevisionId,
    focusedRevisionId,
    selectedRevisionId,
  );
  const borderPolicy = getRevisionBorderPolicy({
    rowState,
    previousRowState,
    nextRowState,
  });
  const detailRowCount = isExpanded ? Math.max(revision.files.length, 1) : 0;
  const gutterPlan = buildRevisionGutterPlan({
    graphHead: revision.graphHead,
    graphTail: revision.graphTail,
    detailRowCount,
    ownsTop: borderPolicy.ownsTop,
    ownsBottom: borderPolicy.ownsBottom,
    previousGraphHead: props.index > 0 ? state.revisions[props.index - 1]?.graphHead ?? null : null,
    nextGraphHead: state.revisions[props.index + 1]?.graphHead ?? null,
  });
  const borderColor = rowState === "selected"
    ? colors.rowSelectedAccent
    : rowState === "focused"
      ? colors.chromeBorderFocus
      : isCommandTarget
      ? colors.rowCommandTargetBorder
      : colors.chromeBorderIdle;
  const titleGraphColor = isSelected
    ? colors.rowSelectedAccent
    : isFocused
      ? colors.chromeBorderFocus
      : markerColor(revision, colors);
  const continuationGraphColor = isSelected
    ? colors.rowSelectedAccent
    : isFocused
      ? colors.chromeBorderFocus
      : colors.textMuted;

  return (
    <box
      id={`revision-${revision.changeId}`}
      width="100%"
      flexDirection="row"
      opacity={anyExpanded && !isExpanded ? 0.6 : 1}
    >
      <box width={graphWidth} flexDirection="column">
        {gutterPlan.topDivider !== null ? (
          <text fg={continuationGraphColor}>
            {padRight(gutterPlan.topDivider, graphWidth)}
          </text>
        ) : null}
        <text fg={titleGraphColor}>{padRight(gutterPlan.title, graphWidth)}</text>
        <text fg={continuationGraphColor}>
          {padRight(gutterPlan.subtitle, graphWidth)}
        </text>
        <For each={gutterPlan.tail}>
          {(graphLine) => (
            <text fg={continuationGraphColor}>
              {padRight(graphLine, graphWidth)}
            </text>
          )}
        </For>
        <For each={gutterPlan.detail}>
          {(graphLine) => (
            <text fg={continuationGraphColor}>
              {padRight(graphLine, graphWidth)}
            </text>
          )}
        </For>
        {gutterPlan.bottomDivider !== null ? (
          <text fg={continuationGraphColor}>
            {padRight(gutterPlan.bottomDivider, graphWidth)}
          </text>
        ) : null}
      </box>
      <box width={1} />
      <box
        flexGrow={1}
        flexDirection="column"
        paddingRight={1}
        backgroundColor={
          isSelected
            ? colors.rowSelectedFill
            : isFocused
            ? colors.rowFocusedFill
            : isAffected
              ? colors.rowAffectedFill
              : undefined
        }
        border={borderPolicy.borderSides}
        borderStyle="single"
        borderColor={borderColor}
        customBorderChars={borderPolicy.borderChars}
      >
        <box width="100%" flexDirection="row" gap={1}>
          <text fg={isSelected ? colors.rowSelectedAccent : isFocused ? colors.chromeBorderFocus : colors.textPrimary}>
            {revision.changeId}
          </text>
          {isCommandTarget ? (
            <text fg={colors.bookmarkTagText} bg={colors.rowCommandTargetBorder}>
              {" onto "}
            </text>
          ) : null}
          <For each={revision.bookmarks}>
            {(bookmark) => (
              <text fg={colors.bookmarkTagText} bg={colors.bookmarkTagFill}>
                {` ${bookmark} `}
              </text>
            )}
          </For>
          <For each={revision.workspaces}>
            {(workspace) => (
              <text fg={colors.workspaceTagText} bg={colors.workspaceTagFill}>
                {` ${workspace} `}
              </text>
            )}
          </For>
        </box>
        <box width="100%" flexDirection="row">
          <text fg={isSelected || isFocused ? colors.textPrimary : colors.textSecondary} truncate>
            {revision.description}
          </text>
        </box>
        <For each={gutterPlan.tail}>
          {() => <box width="100%" height={1} />}
        </For>
        {isExpanded ? (
          <ChangedFiles
            state={state}
            revision={revision}
            config={config}
          />
        ) : null}
      </box>
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
        <text fg={colors.textMuted}>Loading changed files...</text>
      ) : (
        <For each={revision.files}>
          {(file, index) => {
            const focused =
              state.focusMode === "files" &&
              state.expandedRevisionId === revision.changeId &&
              state.focusedFileIndex === index();

            return (
              <box
                width="100%"
                flexDirection="row"
                gap={1}
                backgroundColor={focused ? colors.rowFocusedFill : undefined}
              >
                <text fg={focused ? colors.fileFocusMarker : colors.textMuted}>
                  {focused ? ">" : " "}
                </text>
                <text fg={colors.fileStatusAccent}>{file.status}</text>
                <text fg={focused ? colors.textPrimary : colors.textSecondary} truncate>
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
      padding={1}
      flexDirection="column"
    >
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
            : state.statusMessage?.text ?? "No commands executed yet"}
      </text>
      <For each={events}>
        {(event) => (
          <text fg={statusColor(event.level, colors)} truncate>
            {`${new Date(event.createdAt).toLocaleTimeString()} ${event.text}`}
          </text>
        )}
      </For>
      <text fg={colors.textMuted} truncate>
        {helpText}
      </text>
    </box>
  );
}

function normalizeKey(event: { name: string; sequence: string }): string | null {
  if (event.sequence === ":") {
    return ":";
  }

  if (event.name === "return") {
    return "enter";
  }

  if (event.name.length === 1) {
    return event.name.toLowerCase();
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
  selectedRevisionId: string | null,
): RevisionRowState | null {
  if (revisionId === null) {
    return null;
  }

  if (revisionId === selectedRevisionId) {
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

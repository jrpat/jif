import type { VNode } from "@rezi-ui/core";
import { Box, Column, Row, Spacer, Text, VirtualList } from "@rezi-ui/jsx";
import type { ResolvedAppConfig } from "../config/index.ts";
import type { AppState, RevisionSummary, StatusLevel } from "../domain/types.ts";
import {
  commandCanExecute,
  getCurrentRebaseTargetRevisionId,
  getDisplayedCommandText,
  getExpandedRevision,
  getFocusedRevision,
  getOperationAffectedRevisionIds,
} from "../state/store.ts";
import { getVisibleCommands } from "../commands/definitions.ts";

export function renderApp(state: AppState, config: ResolvedAppConfig): VNode {
  const focusedRevision = getFocusedRevision(state);
  const expandedRevision = getExpandedRevision(state);
  const commandText = getDisplayedCommandText(state);
  const visibleCommands = getVisibleCommands(state);
  const helpText = visibleCommands
    .map((command) => `${command.canonicalKeys.join("/")} ${command.title.toLowerCase()}`)
    .join("   ");

  return (
    <Box width="full" height="full" p={1} style={{ fg: config.colorScheme.semanticColors.textPrimary }}>
      <CommandBar state={state} commandText={commandText} config={config} />
      <Spacer size={1} />
      <VirtualList
        id="revision-list"
        focusable
        keyboardNavigation={false}
        width="full"
        height="full"
        items={state.revisions}
        itemHeight={(revision) => computeRevisionHeight(revision, state)}
        estimateItemHeight={(revision) => computeRevisionHeight(revision, state)}
        renderItem={(revision, index) => (
          <RevisionItem
            state={state}
            revision={revision}
            index={index}
            config={config}
            focusedRevisionId={focusedRevision?.changeId ?? null}
            expandedRevisionId={expandedRevision?.changeId ?? null}
            commandTargetId={getCurrentRebaseTargetRevisionId(state)}
          />
        )}
        onSelect={(_revision, index) => {
          void index;
        }}
      />
      <Spacer size={1} />
      <StatusArea state={state} helpText={helpText} config={config} />
    </Box>
  );
}

function CommandBar(props: {
  state: AppState;
  commandText: string;
  config: ResolvedAppConfig;
}): VNode {
  const { state, commandText, config } = props;
  const colors = config.colorScheme.semanticColors;
  const canExecute = commandCanExecute(state);
  const renderedText = renderCursor(
    commandText,
    state.commandBar.focus ? state.commandBar.cursor : null,
  );

  return (
    <Box
      width="full"
      border="single"
      p={1}
      style={{
        ...(state.commandBar.focus
          ? colors.chromeFillTwo !== undefined
            ? { bg: colors.chromeFillTwo }
            : {}
          : colors.chromeFillOne !== undefined
            ? { bg: colors.chromeFillOne }
            : {}),
        fg: colors.textPrimary,
      }}
      borderStyle={{
        fg: state.commandBar.focus ? colors.chromeBorderFocus : colors.chromeBorderIdle,
      }}
    >
      <Row width="full" gap={1}>
        <Text style={{ fg: colors.textSecondary, bold: true }}>command</Text>
        <Text
          style={{
            fg: commandText.length > 0 ? colors.textPrimary : colors.textMuted,
            bold: canExecute,
          }}
          wrap={false}
          textOverflow="ellipsis"
          maxWidth="full"
        >
          {renderedText}
        </Text>
      </Row>
    </Box>
  );
}

function RevisionItem(props: {
  state: AppState;
  revision: RevisionSummary;
  index: number;
  config: ResolvedAppConfig;
  focusedRevisionId: string | null;
  expandedRevisionId: string | null;
  commandTargetId: string | null;
}): VNode {
  const {
    state,
    revision,
    index,
    config,
    focusedRevisionId,
    expandedRevisionId,
    commandTargetId,
  } = props;
  const colors = config.colorScheme.semanticColors;
  const affectedIds = getOperationAffectedRevisionIds(state);
  const isFocused = revision.changeId === focusedRevisionId;
  const isExpanded = revision.changeId === expandedRevisionId;
  const anyExpanded = expandedRevisionId !== null;
  const isAffected = affectedIds.has(revision.changeId);
  const isCommandTarget = commandTargetId === revision.changeId;

  const surface = isFocused
    ? colors.rowFocusedFill
    : isAffected
      ? colors.rowAffectedFill
      : undefined;

  const borderColor = isFocused
    ? colors.chromeBorderFocus
    : isCommandTarget
      ? colors.rowCommandTargetBorder
      : undefined;

  return (
    <Box
      width="full"
      px={1}
      py={0}
      opacity={anyExpanded && !isExpanded ? 0.55 : 1}
      transition={{ duration: 140, properties: ["opacity"] }}
      style={{
        ...(surface !== undefined ? { bg: surface } : {}),
        fg: colors.textPrimary,
      }}
      borderStyle={borderColor !== undefined ? { fg: borderColor } : undefined}
    >
      <Column width="full">
        <RevisionHeader
          revision={revision}
          isFocused={isFocused}
          isAffected={isAffected}
          isCommandTarget={isCommandTarget}
          graphWidth={state.graphWidth}
          config={config}
        />
        <Row width="full" gap={1}>
          <Text style={{ fg: colors.textMuted }}>{padRight("", state.graphWidth)}</Text>
          <Text
            style={{
              fg: isFocused ? colors.textPrimary : colors.textSecondary,
              bold: isFocused,
            }}
            wrap={false}
            textOverflow="ellipsis"
            maxWidth="full"
          >
            {revision.description}
          </Text>
        </Row>
        {revision.graphTail.map((graphLine) => (
          <Row width="full" gap={1}>
            <Text style={{ fg: colors.textMuted }}>{padRight(graphLine, state.graphWidth)}</Text>
            <Text style={{ fg: colors.textMuted }}> </Text>
          </Row>
        ))}
        {isExpanded ? <>{renderChangedFiles(state, revision, config)}</> : null}
        {index < state.revisions.length - 1 ? <Spacer size={1} /> : null}
      </Column>
    </Box>
  );
}

function RevisionHeader(props: {
  revision: RevisionSummary;
  isFocused: boolean;
  isAffected: boolean;
  isCommandTarget: boolean;
  graphWidth: number;
  config: ResolvedAppConfig;
}): VNode {
  const { revision, isFocused, isAffected, isCommandTarget, graphWidth, config } = props;
  const colors = config.colorScheme.semanticColors;

  return (
    <Row width="full" gap={1}>
      <Text
        style={{
          fg: markerColor(revision.marker, isAffected, config),
          bold: isFocused || isCommandTarget,
        }}
      >
        {padRight(revision.graphHead, graphWidth)}
      </Text>
      <Row width="full" gap={1}>
        <Text
          style={{
            fg: isFocused ? colors.chromeBorderFocus : colors.textPrimary,
            bold: true,
          }}
        >
          {revision.changeId}
        </Text>
        {revision.bookmarks.map((bookmark) => (
          <SemanticPill
            text={bookmark}
            fill={firstDefinedColor(
              colors.bookmarkTagFill,
              colors.statusInfo,
              colors.textSecondary,
              config.colorScheme.theme.colors.fg.secondary,
            )}
            foreground={firstDefinedColor(
              colors.bookmarkTagText,
              colors.textPrimary,
              config.colorScheme.theme.colors.fg.primary,
            )}
          />
        ))}
        {revision.workspaces.map((workspace) => (
          <SemanticPill
            text={workspace}
            fill={firstDefinedColor(
              colors.workspaceTagFill,
              colors.graphWorkingCopy,
              colors.textSecondary,
              config.colorScheme.theme.colors.fg.secondary,
            )}
            foreground={firstDefinedColor(
              colors.workspaceTagText,
              colors.textPrimary,
              config.colorScheme.theme.colors.fg.primary,
            )}
          />
        ))}
      </Row>
    </Row>
  );
}

function SemanticPill(props: {
  text: string;
  fill: number;
  foreground: number;
}): VNode {
  return (
    <Box
      px={1}
      border="rounded"
      style={{ bg: props.fill }}
      borderStyle={{ fg: props.fill }}
    >
      <Text style={{ fg: props.foreground }}>{props.text}</Text>
    </Box>
  );
}

function renderChangedFiles(
  state: AppState,
  revision: RevisionSummary,
  config: ResolvedAppConfig,
): readonly VNode[] {
  const colors = config.colorScheme.semanticColors;

  if (revision.files.length === 0) {
    return [
      <Row width="full" gap={1}>
        <Text style={{ fg: colors.textMuted }}>{padRight("", state.graphWidth)}</Text>
        <Text style={{ fg: colors.textMuted }}>No changed files</Text>
      </Row>,
    ];
  }

  return revision.files.map((file, index) => {
    const isFocused =
      revision.changeId === state.expandedRevisionId && index === state.focusedFileIndex;

    return (
      <Row width="full" gap={1}>
        <Text style={{ fg: colors.textMuted }}>{padRight("", state.graphWidth)}</Text>
        <Text
          style={{
            fg: isFocused ? colors.fileFocusMarker : colors.textMuted,
            bold: isFocused,
          }}
        >
          {isFocused ? ">" : " "}
        </Text>
        <Text style={{ fg: colors.fileStatusAccent, bold: true }}>{file.status}</Text>
        <Text
          style={{
            fg: isFocused ? colors.textPrimary : colors.textSecondary,
            bold: isFocused,
          }}
        >
          {file.path}
        </Text>
      </Row>
    );
  });
}

function StatusArea(props: {
  state: AppState;
  helpText: string;
  config: ResolvedAppConfig;
}): VNode {
  const { state, helpText, config } = props;
  const colors = config.colorScheme.semanticColors;
  const entries = state.eventLog.slice(-4);

  return (
    <Box
      width="full"
      border="single"
      p={1}
      style={{
        ...(colors.chromeFillOne !== undefined ? { bg: colors.chromeFillOne } : {}),
        fg: colors.textPrimary,
      }}
      borderStyle={{ fg: colors.chromeBorderIdle }}
    >
      <Text
        style={{ fg: colors.textSecondary }}
        wrap={false}
        textOverflow="ellipsis"
        maxWidth="full"
      >
        {helpText || ": command bar   j/k move   h/l close/open"}
      </Text>
      <Spacer size={1} />
      {state.statusMessage ? (
        <Row width="full" gap={1}>
          <Text style={{ fg: levelColor(state.statusMessage.level, config), bold: true }}>
            {levelLabel(state.statusMessage.level)}
          </Text>
          <Text
            style={{ fg: colors.textPrimary }}
            wrap={false}
            textOverflow="ellipsis"
            maxWidth="full"
          >
            {state.statusMessage.text}
          </Text>
        </Row>
      ) : (
        <Text style={{ fg: colors.textMuted }}>No commands executed yet</Text>
      )}
      {entries.length > 0 ? <Spacer size={1} /> : null}
      {entries.map((entry) => (
        <Row width="full" gap={1}>
          <Text style={{ fg: levelColor(entry.level, config), bold: true }}>
            {levelLabel(entry.level)}
          </Text>
          <Text style={{ fg: colors.textSecondary }} textOverflow="ellipsis" maxWidth="full">
            {entry.text}
          </Text>
        </Row>
      ))}
    </Box>
  );
}

function computeRevisionHeight(revision: RevisionSummary, state: AppState): number {
  let height = 2 + revision.graphTail.length;
  if (state.expandedRevisionId === revision.changeId) {
    height += Math.max(revision.files.length, 1);
  }
  height += 1;
  return height;
}

function markerColor(
  marker: RevisionSummary["marker"],
  isAffected: boolean,
  config: ResolvedAppConfig,
) {
  const colors = config.colorScheme.semanticColors;
  if (isAffected) {
    return colors.statusSuccess;
  }

  switch (marker) {
    case "working-copy":
      return colors.graphWorkingCopy;
    case "immutable":
      return colors.graphImmutable;
    case "bookmark":
      return colors.graphBookmark;
    case "plain":
      return colors.graphPlain;
  }
}

function levelColor(level: StatusLevel, config: ResolvedAppConfig) {
  const colors = config.colorScheme.semanticColors;
  switch (level) {
    case "success":
      return colors.statusSuccess;
    case "warning":
      return colors.statusWarning;
    case "error":
      return colors.statusError;
    case "info":
      return colors.statusInfo;
  }
}

function levelLabel(level: StatusLevel): string {
  switch (level) {
    case "success":
      return "OK";
    case "warning":
      return "WARN";
    case "error":
      return "ERR";
    case "info":
      return "INFO";
  }
}

function renderCursor(text: string, cursor: number | null): string {
  if (cursor === null) {
    return text || "<empty>";
  }

  const safeCursor = Math.min(Math.max(cursor, 0), text.length);
  return `${text.slice(0, safeCursor)}|${text.slice(safeCursor)}` || "|";
}

function padRight(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function firstDefinedColor(...values: Array<number | undefined>): number {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }

  return 0xffffff;
}

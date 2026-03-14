import { rgb, ui, type VNode } from "@rezi-ui/core";
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

const palette = {
  background: rgb(13, 16, 21),
  surface: rgb(24, 31, 39),
  surfaceAlt: rgb(18, 23, 30),
  focus: rgb(187, 126, 48),
  accent: rgb(70, 140, 220),
  success: rgb(90, 180, 120),
  warning: rgb(220, 170, 80),
  error: rgb(215, 96, 96),
  text: rgb(225, 230, 235),
  muted: rgb(150, 160, 170),
  dim: rgb(95, 104, 114),
};

export function renderApp(state: AppState): VNode {
  const focusedRevision = getFocusedRevision(state);
  const expandedRevision = getExpandedRevision(state);
  const commandText = getDisplayedCommandText(state);
  const visibleCommands = getVisibleCommands(state);
  const helpText = visibleCommands
    .map((command) => `${command.canonicalKeys.join("/")} ${command.title.toLowerCase()}`)
    .join("   ");

  return ui.box(
    {
      width: "full",
      height: "full",
      style: { bg: palette.background, fg: palette.text },
      p: 1,
    },
    [
      renderCommandBar(state, commandText),
      ui.spacer({ size: 1 }),
      ui.virtualList({
        id: "revision-list",
        focusable: true,
        keyboardNavigation: false,
        width: "full",
        height: "full",
        items: state.revisions,
        itemHeight: (revision) => computeRevisionHeight(revision, state),
        estimateItemHeight: (revision) => computeRevisionHeight(revision, state),
        renderItem: (revision, index) =>
          renderRevisionItem({
            state,
            revision,
            index,
            focusedRevisionId: focusedRevision?.changeId ?? null,
            expandedRevisionId: expandedRevision?.changeId ?? null,
            commandTargetId: getCurrentRebaseTargetRevisionId(state),
          }),
        onSelect: (_revision, index) => {
          // Selection is driven by the app state and keybindings. Click selection
          // is not yet implemented in the reducer, so this is a visual-only list.
          void index;
        },
      }),
      ui.spacer({ size: 1 }),
      renderStatusArea(state, helpText),
    ],
  );
}

function renderCommandBar(state: AppState, commandText: string): VNode {
  const canExecute = commandCanExecute(state);
  const renderedText = renderCursor(commandText, state.commandBar.focus ? state.commandBar.cursor : null);

  return ui.box(
    {
      width: "full",
      border: "single",
      p: 1,
      style: {
        bg: state.commandBar.focus ? palette.surface : palette.surfaceAlt,
        fg: palette.text,
      },
      borderStyle: {
        fg: state.commandBar.focus ? palette.focus : palette.dim,
      },
    },
    [
      ui.row({ width: "full", gap: 1 }, [
        ui.text("command", {
          style: { fg: palette.muted, bold: true },
        }),
        ui.text(renderedText, {
          style: {
            fg: commandText.length > 0 ? palette.text : palette.dim,
            bold: canExecute,
          },
          wrap: false,
          textOverflow: "ellipsis",
          maxWidth: "full",
        }),
      ]),
    ],
  );
}

function renderRevisionItem(params: {
  state: AppState;
  revision: RevisionSummary;
  index: number;
  focusedRevisionId: string | null;
  expandedRevisionId: string | null;
  commandTargetId: string | null;
}): VNode {
  const { state, revision, index, focusedRevisionId, expandedRevisionId, commandTargetId } = params;
  const affectedIds = getOperationAffectedRevisionIds(state);
  const isFocused = revision.changeId === focusedRevisionId;
  const isExpanded = revision.changeId === expandedRevisionId;
  const anyExpanded = expandedRevisionId !== null;
  const isAffected = affectedIds.has(revision.changeId);
  const isCommandTarget = commandTargetId === revision.changeId;

  const surface = isFocused
    ? palette.surface
    : isAffected
      ? rgb(36, 41, 30)
      : palette.background;

  const borderColor = isFocused
    ? palette.focus
    : isCommandTarget
      ? palette.accent
      : isAffected
        ? palette.success
        : palette.background;

  return ui.box(
    {
      width: "full",
      px: 1,
      py: 0,
      opacity: anyExpanded && !isExpanded ? 0.55 : 1,
      transition: { duration: 140, properties: ["opacity"] },
      style: { bg: surface, fg: palette.text },
      borderStyle: { fg: borderColor },
    },
    [
      ui.column({ width: "full" }, [
        renderRevisionHeader(revision, isFocused, isAffected, isCommandTarget, state.graphWidth),
        ui.row({ width: "full", gap: 1 }, [
          ui.text(padRight("", state.graphWidth), {
            style: { fg: palette.dim },
          }),
          ui.text(revision.description, {
            style: {
              fg: isFocused ? palette.text : palette.muted,
              bold: isFocused,
            },
            wrap: false,
            textOverflow: "ellipsis",
            maxWidth: "full",
          }),
        ]),
        ...revision.graphTail.map((graphLine) =>
          ui.row({ width: "full", gap: 1 }, [
            ui.text(padRight(graphLine, state.graphWidth), {
              style: { fg: palette.dim },
            }),
            ui.text(" ", { style: { fg: palette.dim } }),
          ]),
        ),
        ...(isExpanded ? renderChangedFiles(state, revision) : []),
        ...(index < state.revisions.length - 1 ? [ui.spacer({ size: 1 })] : []),
      ]),
    ],
  );
}

function renderRevisionHeader(
  revision: RevisionSummary,
  isFocused: boolean,
  isAffected: boolean,
  isCommandTarget: boolean,
  graphWidth: number,
): VNode {
  const tagNodes = [
    ...revision.bookmarks.map((bookmark) =>
      renderPill(bookmark, {
        bg: rgb(43, 66, 96),
        fg: rgb(210, 228, 255),
      }),
    ),
    ...revision.workspaces.map((workspace) =>
      renderPill(workspace, {
        bg: rgb(77, 58, 28),
        fg: rgb(250, 220, 170),
      }),
    ),
  ];

  return ui.row({ width: "full", gap: 1 }, [
    ui.text(padRight(revision.graphHead, graphWidth), {
      style: {
        fg: markerColor(revision.marker, isAffected),
        bold: isFocused || isCommandTarget,
      },
    }),
    ui.row({ width: "full", gap: 1 }, [
      ui.text(revision.changeId, {
        style: {
          fg: isFocused ? palette.focus : palette.text,
          bold: true,
        },
      }),
      ...tagNodes,
    ]),
  ]);
}

function renderChangedFiles(state: AppState, revision: RevisionSummary): readonly VNode[] {
  if (revision.files.length === 0) {
    return [
      ui.row({ width: "full", gap: 1 }, [
        ui.text(padRight("", state.graphWidth), { style: { fg: palette.dim } }),
        ui.text("No changed files", {
          style: { fg: palette.dim },
        }),
      ]),
    ];
  }

  return revision.files.map((file, index) => {
    const isFocused = revision.changeId === state.expandedRevisionId && index === state.focusedFileIndex;
    return ui.row({ width: "full", gap: 1 }, [
      ui.text(padRight("", state.graphWidth), { style: { fg: palette.dim } }),
      ui.text(isFocused ? ">" : " ", {
        style: { fg: isFocused ? palette.focus : palette.dim, bold: isFocused },
      }),
      ui.text(file.status, {
        style: { fg: palette.accent, bold: true },
      }),
      ui.text(file.path, {
        style: { fg: isFocused ? palette.text : palette.muted, bold: isFocused },
      }),
    ]);
  });
}

function renderStatusArea(state: AppState, helpText: string): VNode {
  const entries = state.eventLog.slice(-4).map((entry) =>
    ui.row({ width: "full", gap: 1 }, [
      ui.text(levelLabel(entry.level), {
        style: { fg: levelColor(entry.level), bold: true },
      }),
      ui.text(entry.text, {
        style: { fg: palette.muted },
        textOverflow: "ellipsis",
        maxWidth: "full",
      }),
    ]),
  );

  return ui.box(
    {
      width: "full",
      border: "single",
      p: 1,
      style: { bg: palette.surfaceAlt, fg: palette.text },
      borderStyle: { fg: palette.dim },
    },
    [
      ui.text(helpText || ": command bar   j/k move   h/l close/open", {
        style: { fg: palette.muted },
        wrap: false,
        textOverflow: "ellipsis",
        maxWidth: "full",
      }),
      ui.spacer({ size: 1 }),
      state.statusMessage
        ? ui.row({ width: "full", gap: 1 }, [
            ui.text(levelLabel(state.statusMessage.level), {
              style: { fg: levelColor(state.statusMessage.level), bold: true },
            }),
            ui.text(state.statusMessage.text, {
              style: { fg: palette.text },
              wrap: false,
              textOverflow: "ellipsis",
              maxWidth: "full",
            }),
          ])
        : ui.text("No commands executed yet", {
            style: { fg: palette.dim },
          }),
      ...(entries.length > 0 ? [ui.spacer({ size: 1 }), ...entries] : []),
    ],
  );
}

function renderPill(
  text: string,
  style: Readonly<{ bg: ReturnType<typeof rgb>; fg: ReturnType<typeof rgb> }>,
): VNode {
  return ui.box(
    {
      px: 1,
      style,
      border: "rounded",
      borderStyle: { fg: style.bg },
    },
    [ui.text(text, { style: { fg: style.fg } })],
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

function markerColor(marker: RevisionSummary["marker"], isAffected: boolean) {
  if (isAffected) {
    return palette.success;
  }

  switch (marker) {
    case "working-copy":
      return palette.focus;
    case "immutable":
      return palette.dim;
    case "bookmark":
      return palette.accent;
    case "plain":
      return palette.muted;
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

function levelColor(level: StatusLevel) {
  switch (level) {
    case "success":
      return palette.success;
    case "warning":
      return palette.warning;
    case "error":
      return palette.error;
    case "info":
      return palette.accent;
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

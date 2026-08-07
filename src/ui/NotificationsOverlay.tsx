import { For, Show, createMemo } from "solid-js";
import { MouseButton, type MouseEvent } from "@opentui/core";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { EventLogEntry } from "../domain/types.ts";
import { ScrollableAnsiBody } from "./scrollableAnsiBody.tsx";
import { getNotificationCommandLineCount } from "./notificationContent.ts";
import { getStatusColor, getStatusFillColor } from "./statusMessages.ts";

const COLLAPSED_LINE_LIMIT = 5;

export function NotificationsOverlay(props: Readonly<{
  entries: readonly EventLogEntry[];
  focusedIndex: number;
  expandedIds: readonly string[];
  config: ResolvedAppConfig;
  onFocusEntry?: (index: number) => void;
}>) {
  const colors = () => props.config.colorScheme.semanticColors;
  const expandedSet = createMemo(() => new Set(props.expandedIds));

  return (
    <Show
      when={props.entries.length > 0}
      fallback={(
        <box width="100%" paddingX={1} paddingY={1}>
          <text fg={colors().textTertiary}>No notifications yet.</text>
        </box>
      )}
    >
      <box width="100%" flexDirection="column" paddingX={1} paddingY={1}>
        <For each={props.entries}>
          {(entry, index) => {
            const expanded = createMemo(() => expandedSet().has(entry.id));
            return (
              <NotificationCard
                id={`notification-${index()}`}
                entry={entry}
                expanded={expanded()}
                focused={props.focusedIndex === index()}
                config={props.config}
                onMouseFocus={() => props.onFocusEntry?.(index())}
              />
            );
          }}
        </For>
      </box>
    </Show>
  );
}

function NotificationCard(props: Readonly<{
  id: string;
  entry: EventLogEntry;
  expanded: boolean;
  focused: boolean;
  config: ResolvedAppConfig;
  onMouseFocus?: () => void;
}>) {
  const colors = () => props.config.colorScheme.semanticColors;
  const lines = createMemo(() => props.entry.text.split(/\r\n|\r|\n/));
  const commandLineCount = createMemo(() =>
    getNotificationCommandLineCount(props.entry.commandText)
  );
  const visibleLines = createMemo(() => {
    if (props.expanded) return lines();
    const visibleOutputLineLimit = Math.max(0, COLLAPSED_LINE_LIMIT - commandLineCount());
    return lines().slice(0, visibleOutputLineLimit);
  });
  const bodyHeight = createMemo(() => visibleLines().length + commandLineCount());
  const hiddenCount = createMemo(() => Math.max(0, lines().length - visibleLines().length));
  const borderColor = createMemo(() => getStatusColor(props.entry.level, colors()));
  const backgroundColor = createMemo(() =>
    props.focused ? getStatusFillColor(props.entry.level, colors()) : undefined
  );
  const timestamp = createMemo(() => formatTimestamp(props.entry.createdAt));

  return (
    <box
      id={props.id}
      width="100%"
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={borderColor()}
      backgroundColor={backgroundColor()}
      paddingX={1}
      onMouseDown={(event: MouseEvent) => {
        if (event.button !== MouseButton.LEFT) return;
        props.onMouseFocus?.();
      }}
    >
      <box width="100%" flexDirection="row">
        <text fg={borderColor()}>{labelForLevel(props.entry.level)}</text>
        <box flexGrow={1} />
        <text fg={colors().textTertiary}>{timestamp()}</text>
      </box>
      <box width="100%" height={1} />
      <ScrollableAnsiBody
        text={visibleLines().join("\n")}
        commandText={props.entry.commandText}
        commandColor={borderColor()}
        bodyHeight={bodyHeight()}
        config={props.config}
        backgroundColor={backgroundColor()}
      />
      <Show when={hiddenCount() > 0}>
        <text fg={colors().textTertiary}>
          {`+${hiddenCount()} more line${hiddenCount() === 1 ? "" : "s"} (l to expand)`}
        </text>
      </Show>
    </box>
  );
}

function labelForLevel(level: EventLogEntry["level"]): string {
  switch (level) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "error":
      return "error";
    default:
      return "info";
  }
}

function formatTimestamp(epochMs: number): string {
  const date = new Date(epochMs);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

import { For, Show, createMemo } from "solid-js";
import { MouseButton, type MouseEvent } from "@opentui/core";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { EventLogEntry } from "../domain/types.ts";
import { ScrollableAnsiBody } from "./scrollableAnsiBody.tsx";
import { getStatusColor, getStatusFillColor } from "./statusMessages.ts";

const COLLAPSED_LINE_LIMIT = 5;

type EntryViewModel = Readonly<{
  entry: EventLogEntry;
  totalLines: number;
  visibleLines: readonly string[];
}>;

export function NotificationsOverlay(props: Readonly<{
  entries: readonly EventLogEntry[];
  focusedIndex: number;
  expandedIds: readonly string[];
  config: ResolvedAppConfig;
  onFocusEntry?: (index: number) => void;
}>) {
  const colors = () => props.config.colorScheme.semanticColors;
  const expandedSet = createMemo(() => new Set(props.expandedIds));

  const entryViewModels = createMemo<readonly EntryViewModel[]>(() =>
    props.entries.map((entry) => {
      const lines = entry.text.split(/\r\n|\r|\n/);
      const visibleLines = expandedSet().has(entry.id) ? lines : lines.slice(0, COLLAPSED_LINE_LIMIT);
      return { entry, totalLines: lines.length, visibleLines };
    }),
  );

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
        <For each={entryViewModels()}>
          {(model, index) => (
            <NotificationCard
              id={`notification-${index()}`}
              model={model}
              focused={props.focusedIndex === index()}
              config={props.config}
              onMouseFocus={() => props.onFocusEntry?.(index())}
            />
          )}
        </For>
      </box>
    </Show>
  );
}

function NotificationCard(props: Readonly<{
  id: string;
  model: EntryViewModel;
  focused: boolean;
  config: ResolvedAppConfig;
  onMouseFocus?: () => void;
}>) {
  const colors = () => props.config.colorScheme.semanticColors;
  const hiddenCount = () => Math.max(0, props.model.totalLines - props.model.visibleLines.length);
  const borderColor = createMemo(() => getStatusColor(props.model.entry.level, colors()));
  const backgroundColor = createMemo(() =>
    props.focused ? getStatusFillColor(props.model.entry.level, colors()) : undefined
  );
  const timestamp = createMemo(() => formatTimestamp(props.model.entry.createdAt));

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
        <text fg={borderColor()}>{labelForLevel(props.model.entry.level)}</text>
        <box flexGrow={1} />
        <text fg={colors().textTertiary}>{timestamp()}</text>
      </box>
      <ScrollableAnsiBody
        text={props.model.visibleLines.join("\n")}
        bodyHeight={props.model.visibleLines.length}
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

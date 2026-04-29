import { TextAttributes } from "@opentui/core";
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { StatusMessage } from "../domain/types.ts";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { ShortcutGrid, ShortcutSummarySegment } from "./shortcutPanel.ts";
import { parseAnsiToStyledText } from "./ansiToStyledText.ts";
import { getStatusColor, getStatusMessageDismissDelay } from "./statusMessages.ts";
import { SPINNER_INTERVAL_MS, formatSpinnerText } from "./spinner.ts";

export function StatusArea(props: {
  shortcutSummary: string;
  shortcutSummarySegments: readonly ShortcutSummarySegment[];
  shortcutGrid: ShortcutGrid;
  expanded: boolean;
  currentModeLabel: string;
  panelBodyHeight: number;
  actionLabel?: string | null;
  config: ResolvedAppConfig;
  loadingIndicatorText?: string | null;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const [loadingFrameIndex, setLoadingFrameIndex] = createSignal(0);
  const loadingIndicator = createMemo(() =>
    props.loadingIndicatorText
      ? formatSpinnerText(props.loadingIndicatorText, loadingFrameIndex())
      : null
  );

  createEffect(() => {
    if (!props.loadingIndicatorText) {
      setLoadingFrameIndex(0);
      return;
    }

    const handle = setInterval(() => {
      setLoadingFrameIndex((current) => current + 1);
    onCleanup(() => clearInterval(handle));
  });

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
          <Show when={loadingIndicator() !== null}>
            <text fg={getStatusColor("info", colors)}>{loadingIndicator()}</text>
            <box width={3} />
          </Show>
          <box flexGrow={1} minWidth={0} flexDirection="row">
            <Show
              when={props.shortcutSummarySegments.length > 0}
              fallback={
                <text fg={colors.textTertiary} truncate>
                  {props.shortcutSummary}
                </text>
              }
            >
              <For each={props.shortcutSummarySegments}>
                {(segment, index) => (
                  <box flexDirection="row">
                    <Show when={index() > 0}>
                      <text fg={colors.textTertiary}>{"   "}</text>
                    </Show>
                    <text fg={colors.textTertiary} attributes={TextAttributes.BOLD}>
                      {segment.keyLabel}
                    </text>
                    <text fg={colors.textTertiary}>{` ${segment.label}`}</text>
                  </box>
                )}
              </For>
            </Show>
          </box>
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
          <Show when={loadingIndicator() !== null}>
            <text fg={getStatusColor("info", colors)} truncate>{loadingIndicator()}</text>
            <box width={1} />
          </Show>
          <Show when={props.actionLabel !== null && props.actionLabel !== undefined}>
            <text fg={colors.textTertiary}>{props.actionLabel}</text>
          </Show>
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
  );
}

export function MessageOverlay(props: {
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
      borderColor={getStatusColor("info", colors)}
      paddingX={1}
    >
      <text fg={getStatusColor("info", colors)} wrapMode="word">
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
      borderColor={getStatusColor(props.message.level, colors)}
      paddingX={1}
    >
      <text ref={textRef} fg={colors.textPrimary} wrapMode="word" />
    </box>
  );
}

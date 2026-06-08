import { TextAttributes } from "@opentui/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { StatusMessage } from "../domain/types.ts";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { ShortcutGrid, ShortcutPanelLayout, ShortcutSummarySegment } from "./shortcutPanel.ts";
import { ScrollableAnsiBody } from "./scrollableAnsiBody.tsx";
import { observeScrollboxInteraction } from "./scroll.ts";
import {
  getHelpToastBorderColor,
  getStatusColor,
  getStatusMessageDismissDelay,
  getStatusToastBodyHeight,
} from "./statusMessages.ts";
import { SPINNER_INTERVAL_MS, formatSpinnerText } from "./spinner.ts";

export function StatusArea(props: {
  shortcutSummary: string;
  shortcutSummarySegments: readonly ShortcutSummarySegment[];
  shortcutLayout: ShortcutPanelLayout;
  expanded: boolean;
  currentModeLabel: string;
  panelBodyHeight: number;
  actionLabel?: string | null;
  config: ResolvedAppConfig;
  loadingIndicatorText?: string | null;
  emptyMessage?: string;
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
    }, SPINNER_INTERVAL_MS);
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
            when={!isLayoutEmpty(props.shortcutLayout)}
            fallback={
              <box width="100%" paddingX={1}>
                <text fg={colors.textTertiary}>
                  {props.emptyMessage ?? "No shortcuts for this mode."}
                </text>
              </box>
            }
          >
            <Show
              when={props.shortcutLayout.kind === "single"}
              fallback={
                <SplitShortcutBody
                  layout={props.shortcutLayout as Extract<ShortcutPanelLayout, { kind: "split" }>}
                  colors={colors}
                />
              }
            >
              <ShortcutGridBody
                grid={(props.shortcutLayout as Extract<ShortcutPanelLayout, { kind: "single" }>).grid}
                colors={colors}
              />
            </Show>
          </Show>
        </scrollbox>
      </box>
    </Show>
  );
}

function isLayoutEmpty(layout: ShortcutPanelLayout): boolean {
  if (layout.kind === "single") return layout.grid.rows.length === 0;
  return layout.topGrid.rows.length === 0 && layout.bottomGrid.rows.length === 0;
}

function dividerWidth(topGrid: ShortcutGrid, bottomGrid: ShortcutGrid): number {
  const span = (grid: ShortcutGrid) =>
    grid.columnCount * grid.columnWidth + Math.max(0, grid.columnCount - 1) * grid.gap;
  return Math.max(1, span(topGrid), span(bottomGrid));
}

function ShortcutGridBody(props: {
  grid: ShortcutGrid;
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
}) {
  return (
    <box width="100%" flexDirection="column" paddingX={1}>
      <For each={props.grid.rows}>
        {(row) => (
          <box width="100%" flexDirection="row" gap={props.grid.gap}>
            <For each={row}>
              {(entry) => (
                <box
                  width={props.grid.columnWidth}
                  minWidth={0}
                  flexDirection="row"
                >
                  <box width={props.grid.keyWidth} flexShrink={0}>
                    <text
                      fg={props.colors.chromeBorderFocus}
                      attributes={TextAttributes.BOLD}
                      truncate
                    >
                      {entry.keyLabel}
                    </text>
                  </box>
                  <box flexGrow={1} minWidth={0}>
                    <text fg={props.colors.textSecondary} truncate>
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
  );
}

function SplitShortcutBody(props: {
  layout: Extract<ShortcutPanelLayout, { kind: "split" }>;
  colors: ResolvedAppConfig["colorScheme"]["semanticColors"];
}) {
  const hasTop = () => props.layout.topGrid.rows.length > 0;
  const hasBottom = () => props.layout.bottomGrid.rows.length > 0;
  return (
    <box width="100%" flexDirection="column">
      <Show when={hasTop()}>
        <ShortcutGridBody grid={props.layout.topGrid} colors={props.colors} />
      </Show>
      <Show when={hasTop() && hasBottom()}>
        <box width="100%" height={1} paddingX={1}>
          <text fg={props.colors.chromeBorderIdle} truncate>
            {"─".repeat(dividerWidth(props.layout.topGrid, props.layout.bottomGrid))}
          </text>
        </box>
      </Show>
      <Show when={hasBottom()}>
        <ShortcutGridBody grid={props.layout.bottomGrid} colors={props.colors} />
      </Show>
    </box>
  );
}

export function MessageOverlay(props: {
  messages: readonly StatusMessage[];
  loading: boolean;
  config: ResolvedAppConfig;
  bottomInset: number;
  maxToastBodyHeight: number;
  maxHelpToastBodyHeight?: number;
  registerHelpViewport?: (el: ScrollBoxRenderable | undefined) => void;
  onInteract: (id: string) => void;
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
                  maxBodyHeight={props.maxToastBodyHeight}
                  maxHelpBodyHeight={props.maxHelpToastBodyHeight ?? props.maxToastBodyHeight}
                  registerHelpViewport={props.registerHelpViewport}
                  onInteract={() => props.onInteract(message.id)}
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
  maxBodyHeight: number;
  maxHelpBodyHeight: number;
  registerHelpViewport?: (el: ScrollBoxRenderable | undefined) => void;
  onInteract: () => void;
  onDismiss: () => void;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const isHelp = () => props.message.variant === "help";
  const bodyHeight = createMemo(() =>
    getStatusToastBodyHeight(
      props.message.text,
      isHelp() ? props.maxHelpBodyHeight : props.maxBodyHeight,
    )
  );
  const borderColor = () =>
    isHelp() ? getHelpToastBorderColor(props.config) : getStatusColor(props.message.level, colors);

  createEffect(() => {
    // Help toasts persist until the user dismisses them; everything else is
    // only auto-dismissed once it has reached its terminal "success" state.
    if (props.message.level !== "success" || isHelp()) return;
    const timer = setTimeout(
      props.onDismiss,
      getStatusMessageDismissDelay(props.message.lastInteractedAt),
    );
    onCleanup(() => clearTimeout(timer));
  });

  let bodyRef: ScrollBoxRenderable | undefined;

  createEffect(() => {
    if (!bodyRef) {
      return;
    }

    const dispose = observeScrollboxInteraction(bodyRef, props.onInteract);
    onCleanup(dispose);
  });

  // Expose the help toast's scrollbox so the controller can drive it from the
  // keyboard (help mode's j/k/J/K). Re-runs when the toast becomes a help
  // toast; the scrollbox is already mounted by then.
  createEffect(() => {
    if (!isHelp() || !bodyRef) {
      return;
    }

    const viewport = bodyRef;
    props.registerHelpViewport?.(viewport);
    onCleanup(() => props.registerHelpViewport?.(undefined));
  });

  return (
    <box
      width="100%"
      backgroundColor={colors.chromeFillOne}
      border
      borderStyle="single"
      borderColor={borderColor()}
      paddingX={1}
    >
      <ScrollableAnsiBody
        id={`status-toast-body-${props.message.id}`}
        text={props.message.text}
        bodyHeight={bodyHeight()}
        config={props.config}
        backgroundColor={colors.chromeFillOne}
        registerScrollbox={(el) => { bodyRef = el; }}
        onMouseScroll={() => props.onInteract()}
      />
    </box>
  );
}

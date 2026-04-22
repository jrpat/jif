import type { ScrollBoxRenderable } from "@opentui/core";
import { For, createMemo, createRenderEffect } from "solid-js";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { AutocompleteFlow } from "./autocomplete.ts";

export type AutocompleteListItem = Readonly<{
  id: string;
  tag?: string;
  text: string;
  detail?: string;
}>;

export function AutocompleteList(props: {
  items: readonly AutocompleteListItem[];
  selectedIndex: number | null;
  flow: AutocompleteFlow;
  config: ResolvedAppConfig;
  maxVisibleItems?: number;
}) {
  const colors = props.config.colorScheme.semanticColors;
  let viewport: ScrollBoxRenderable | undefined;

  const visibleItems = createMemo(() => {
    const mapped = props.items.map((item, logicalIndex) => ({ item, logicalIndex }));
    return props.flow === "top-to-bottom" ? mapped : mapped.slice().reverse();
  });

  const visibleHeight = createMemo(() =>
    Math.min(props.items.length, props.maxVisibleItems ?? 10)
  );

  const scrollToSelection = () => {
    if (!viewport || props.selectedIndex === null) {
      return;
    }

    const child = viewport.findDescendantById(`autocomplete-${props.selectedIndex}`);
    if (!child) {
      return;
    }

    const vpTop = viewport.viewport.y;
    const vpHeight = viewport.viewport.height;
    const vpBottom = vpTop + vpHeight;
    if (child.y < vpTop) {
      viewport.scrollBy(child.y - vpTop);
    } else if (child.y + child.height > vpBottom) {
      viewport.scrollBy(child.y + child.height - vpBottom);
    }
  };

  createRenderEffect(() => {
    props.selectedIndex;
    scrollToSelection();
  });

  return (
    <scrollbox
      ref={(el: ScrollBoxRenderable) => {
        viewport = el;
      }}
      width="100%"
      height={visibleHeight()}
      scrollY
      stickyScroll={props.flow !== "top-to-bottom"}
      stickyStart={props.flow !== "top-to-bottom" ? "bottom" : undefined}
      backgroundColor={colors.chromeFillTwo}
      scrollbarOptions={{
        trackOptions: {
          backgroundColor: colors.chromeFillThree,
          foregroundColor: colors.chromeScrollbarThumb,
        },
      }}
    >
      <box width="100%" flexDirection="column" paddingX={1}>
        <For each={visibleItems()}>
          {({ item, logicalIndex }) => {
            const isSelected = () => logicalIndex === props.selectedIndex;
            const backgroundColor = () => isSelected() ? colors.rowFocusedFill : colors.chromeFillTwo;
            return (
              <box
                id={`autocomplete-${logicalIndex}`}
                width="100%"
                flexDirection="row"
                backgroundColor={backgroundColor()}
              >
                {item.tag ? (
                  <text fg={colors.textTertiary} bg={backgroundColor()}>
                    {item.tag}{" "}
                  </text>
                ) : null}
                <text
                  fg={isSelected() ? colors.chromeBorderFocus : colors.textPrimary}
                  bg={backgroundColor()}
                >
                  {item.text}
                </text>
                {item.detail ? (
                  <text fg={colors.textTertiary} bg={backgroundColor()}>
                    {" "}{item.detail}
                  </text>
                ) : null}
              </box>
            );
          }}
        </For>
      </box>
    </scrollbox>
  );
}

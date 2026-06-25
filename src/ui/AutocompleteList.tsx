import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { For, createMemo, createRenderEffect } from "solid-js";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { AutocompleteFlow } from "./autocomplete.ts";

export type AutocompleteListItem = Readonly<{
  id: string;
  tag?: string;
  text: string;
  detail?: string;
  // Render the main text in bold. Used by command-bar flag completions to make
  // the long flag stand out from its (dim) short alias and description.
  bold?: boolean;
}>;

export function AutocompleteList(props: {
  items: readonly AutocompleteListItem[];
  selectedIndex: number | null;
  // Logical index to underline as the "Tab inserts this" hint (distinct from
  // selection, which highlights). Used by the command bar's complete-at-point.
  underlineIndex?: number | null;
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
    <box
      width="100%"
      height={visibleHeight() + 1}
      flexDirection="column"
      backgroundColor={colors.chromeFillTwo}
    >
      <box width="100%" height={1} backgroundColor={colors.chromeFillTwo} />
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
        <box width="100%" flexDirection="column">
          <For each={visibleItems()}>
            {({ item, logicalIndex }) => {
              const isSelected = () => logicalIndex === props.selectedIndex;
              const backgroundColor = () =>
                isSelected() ? colors.promptSuggestionFocusedFill : colors.chromeFillTwo;
              return (
                <box
                  id={`autocomplete-${logicalIndex}`}
                  width="100%"
                  flexDirection="row"
                  paddingX={1}
                  backgroundColor={backgroundColor()}
                >
                  {item.tag ? (
                    <text fg={colors.textTertiary} bg={backgroundColor()} flexShrink={0} wrapMode="none">
                      {item.tag}{" "}
                    </text>
                  ) : null}
                  <text
                    fg={isSelected() ? colors.chromeBorderFocus : colors.textPrimary}
                    bg={backgroundColor()}
                    flexShrink={0}
                    wrapMode="none"
                    attributes={
                      ((item.bold ? TextAttributes.BOLD : 0) |
                        (logicalIndex === props.underlineIndex ? TextAttributes.UNDERLINE : 0)) ||
                      undefined
                    }
                  >
                    {item.text}
                  </text>
                  {item.detail ? (
                    <text
                      fg={colors.textTertiary}
                      bg={backgroundColor()}
                      flexShrink={1}
                      wrapMode="none"
                    >
                      {" "}{item.detail}
                    </text>
                  ) : null}
                </box>
              );
            }}
          </For>
        </box>
      </scrollbox>
    </box>
  );
}

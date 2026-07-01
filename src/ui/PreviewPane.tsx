import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { For, Show, createMemo } from "solid-js";
import type { ResolvedAppConfig } from "../config/schema.ts";
import {
  countDiffRows,
  estimateDiffWidth,
  fileTypeForPath,
  splitGitDiff,
} from "../domain/previewDiff.ts";
import { buildScrollbarTrackOptions } from "./scrollbarOptions.ts";

/**
 * The preview pane. It renders a git-format diff (from `jj … --git`) using
 * OpenTUI's built-in `<diff>` component. That component only renders the first
 * file of a multi-file patch and is a fixed-height viewer, so we split the diff
 * into one single-file `<diff>` per file and stack them inside a scrollbox.
 * Unwrapped mode uses the exact logical row count from {@link countDiffRows};
 * wrapped mode gives the diff component the available width and lets it wrap.
 *
 * The header scrolls with the diff content (it is the top of the scroll area),
 * but its box is constrained to the viewport width so it word-wraps at the
 * visible width rather than the (potentially much wider) diff width, which is
 * what sizes the horizontally-scrollable content box.
 */
export function PreviewPane(props: {
  header: string | null;
  diff: string;
  loading: boolean;
  viewportWidth: number;
  config: ResolvedAppConfig;
  previewWordWrap: boolean;
  registerScrollbox: (el: ScrollBoxRenderable | undefined) => void;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const files = createMemo(() => splitGitDiff(props.diff));
  // At least the viewport width so short diffs fill the pane; wider than it (so
  // the scrollbox scrolls horizontally) when a diff line is longer. Wrapped
  // mode keeps content at the viewport width so OpenTUI can actually wrap.
  const contentWidth = createMemo(() =>
    props.previewWordWrap
      ? Math.max(1, props.viewportWidth)
      : Math.max(props.viewportWidth, estimateDiffWidth(files()))
  );
  // The header lives inside the (possibly very wide) content box, so pin its
  // width to the viewport minus the content box's horizontal padding, keeping it
  // readable without horizontal scrolling.
  const headerWidth = () => Math.max(1, props.viewportWidth - 2);
  const diffWrapMode = () => props.previewWordWrap ? "word" : "none";

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.chromeFillOne}
    >
      <scrollbox
        ref={(el: ScrollBoxRenderable) => props.registerScrollbox(el)}
        width="100%"
        flexGrow={1}
        scrollX={!props.previewWordWrap}
        scrollY
        viewportCulling
        backgroundColor={colors.chromeFillOne}
        scrollbarOptions={buildScrollbarTrackOptions(
          colors.chromeFillThree,
          colors.chromeScrollbarThumb,
        )}
        contentOptions={{ width: contentWidth(), maxWidth: undefined }}
      >
        <box flexDirection="column" width={contentWidth()} paddingX={1}>
          <Show when={props.header}>
            <box width={headerWidth()} flexShrink={0}>
              <text fg={colors.textSecondary} wrapMode="word">{props.header}</text>
            </box>
          </Show>
          <Show
            when={files().length > 0}
            fallback={(
              <text fg={colors.textTertiary}>
                {props.loading ? "Loading…" : "No changes"}
              </text>
            )}
          >
            <For each={files()}>
              {(file, index) => {
                const rows = countDiffRows(file.patch);
                // A blank line + rule separates each file from what sits above
                // it: the previous file, or — for the first file — the header.
                // Without a header (a single-file preview) the first file needs
                // no separator since nothing sits above it.
                const showSeparator = () => index() > 0 || Boolean(props.header);
                return (
                  <box flexDirection="column" width="100%" flexShrink={0}>
                    <Show when={showSeparator()}>
                      <box
                        height={2}
                        width="100%"
                        flexShrink={0}
                        border={["bottom"]}
                        borderStyle="single"
                        borderColor={colors.chromeBorderIdle}
                      />
                    </Show>
                    <text fg={colors.diffFileName} attributes={TextAttributes.BOLD} wrapMode="none" truncate>
                      {file.path}
                    </text>
                    <Show
                      when={rows > 0}
                      fallback={(
                        <text fg={colors.textTertiary}>· binary or no textual change</text>
                      )}
                    >
                      <diff
                        diff={file.patch}
                        view="unified"
                        wrapMode={diffWrapMode()}
                        showLineNumbers
                        filetype={fileTypeForPath(file.path)}
                        fg={colors.textPrimary}
                        addedBg={colors.diffAddedFill}
                        removedBg={colors.diffRemovedFill}
                        contextBg={colors.chromeFillOne}
                        addedSignColor={colors.diffAddedSign}
                        removedSignColor={colors.diffRemovedSign}
                        lineNumberFg={colors.diffLineNumber}
                        width="100%"
                        height={props.previewWordWrap ? "auto" : rows}
                        flexShrink={0}
                      />
                    </Show>
                  </box>
                );
              }}
            </For>
          </Show>
        </box>
      </scrollbox>
    </box>
  );
}

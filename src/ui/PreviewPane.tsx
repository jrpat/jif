import { RGBA, StyledText, TextAttributes, type ScrollBoxRenderable, type TextChunk } from "@opentui/core";
import { For, Show, createEffect, createMemo } from "solid-js";
import type { ResolvedAppConfig } from "../config/schema.ts";
import {
  countDiffRows,
  estimateDiffWidth,
  fileTypeForPath,
  formatOmittedLineSeparator,
  splitGitDiff,
  splitPatchIntoDiffSections,
} from "../domain/previewDiff.ts";
import { buildPreviewSyntaxStyle } from "./previewSyntaxStyle.ts";
import { buildScrollbarTrackOptions } from "./scrollbarOptions.ts";
import { makeScrollAcceleration } from "./scrollAcceleration.ts";

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
  const syntaxStyle = buildPreviewSyntaxStyle();
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
  const scrollAcceleration = createMemo(() =>
    makeScrollAcceleration(props.config.scroll.step, props.config.scroll.acceleration)
  );

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={colors.previewPaneFill}
    >
      <scrollbox
        ref={(el: ScrollBoxRenderable) => props.registerScrollbox(el)}
        width="100%"
        flexGrow={1}
        scrollX={!props.previewWordWrap}
        scrollY
        viewportCulling
        backgroundColor={colors.previewPaneFill}
        scrollAcceleration={scrollAcceleration()}
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
                const sections = splitPatchIntoDiffSections(file.patch);
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
                      <For each={sections}>
                        {(section) => section.kind === "omission" ? (
                          <box width="100%" height={1} flexShrink={0}>
                            <OmittedLinesSeparator
                              omittedLineCount={section.omittedLineCount}
                              width={headerWidth()}
                              labelColor={colors.textTertiary}
                              ruleColor={halfContrastColor(colors.textTertiary, colors.previewPaneFill)}
                            />
                          </box>
                        ) : (
                          <diff
                            diff={section.patch}
                            view="unified"
                            wrapMode={diffWrapMode()}
                            showLineNumbers
                            filetype={fileTypeForPath(file.path)}
                            syntaxStyle={syntaxStyle}
                            fg={colors.textPrimary}
                            addedBg={colors.diffAddedFill}
                            removedBg={colors.diffRemovedFill}
                            contextBg={colors.previewPaneFill}
                            addedSignColor={colors.diffAddedSign}
                            removedSignColor={colors.diffRemovedSign}
                            lineNumberFg={colors.diffLineNumber}
                            width="100%"
                            height={props.previewWordWrap ? "auto" : countDiffRows(section.patch)}
                            flexShrink={0}
                          />
                        )}
                      </For>
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

function OmittedLinesSeparator(props: {
  omittedLineCount: number;
  width: number;
  labelColor: string | undefined;
  ruleColor: string | undefined;
}) {
  let textRef: any;
  const separator = () =>
    buildOmittedLineSeparatorText(
      props.omittedLineCount,
      props.width,
      props.labelColor,
      props.ruleColor,
    );
  createEffect(() => {
    if (textRef) {
      textRef.content = separator();
    }
  });

  return (
    <text
      ref={(el) => {
        textRef = el;
        if (textRef) textRef.content = separator();
      }}
      wrapMode="none"
    />
  );
}

function buildOmittedLineSeparatorText(
  omittedLineCount: number,
  width: number,
  labelColor: string | undefined,
  ruleColor: string | undefined,
): StyledText {
  const content = formatOmittedLineSeparator(omittedLineCount, width);
  const label = ` ${omittedLineCount} more lines `;
  const labelStart = content.indexOf(label);
  if (labelStart === -1) {
    return new StyledText([styledChunk(content, ruleColor)]);
  }

  return new StyledText([
    styledChunk(content.slice(0, labelStart), ruleColor),
    styledChunk(label, labelColor),
    styledChunk(content.slice(labelStart + label.length), ruleColor),
  ].filter((chunk) => chunk.text.length > 0));
}

function styledChunk(text: string, color: string | undefined): TextChunk {
  const chunk: TextChunk = { __isChunk: true, text };
  if (color) {
    chunk.fg = RGBA.fromHex(color);
  }
  return chunk;
}

function halfContrastColor(foreground: string | undefined, background: string | undefined): string | undefined {
  if (!foreground || !background) return foreground;
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  if (!fg || !bg) return foreground;
  return rgbToHex(
    fg[0] * 0.5 + bg[0] * 0.5,
    fg[1] * 0.5 + bg[1] * 0.5,
    fg[2] * 0.5 + bg[2] * 0.5,
  );
}

function parseHexColor(hex: string): [number, number, number] | null {
  const stripped = hex.startsWith("#") ? hex.slice(1) : hex;
  if (stripped.length !== 6) return null;
  return [
    Number.parseInt(stripped.slice(0, 2), 16),
    Number.parseInt(stripped.slice(2, 4), 16),
    Number.parseInt(stripped.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toChannel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${toChannel(r)}${toChannel(g)}${toChannel(b)}`;
}

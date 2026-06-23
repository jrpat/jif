import { TextBuffer, TextBufferView, type ScrollBoxRenderable, type StyledText } from "@opentui/core";
import { For, createEffect, createMemo } from "solid-js";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { DiffViewerState } from "../domain/types.ts";
import { parseAnsiToStyledText } from "./ansiToStyledText.ts";
import { buildScrollbarTrackOptions } from "./scrollbarOptions.ts";

type DiffLineViewModel = Readonly<{
  styledText: StyledText;
}>;

export function DiffViewer(props: {
  state: DiffViewerState;
  config: ResolvedAppConfig;
  registerScrollbox: (el: ScrollBoxRenderable | undefined) => void;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const lines = createMemo(() =>
    props.state.content.split("\n").map((line): DiffLineViewModel => {
      return {
        styledText: parseAnsiToStyledText(line, props.config.terminalPalette),
      };
    }),
  );
  const contentWidth = createMemo(() =>
    measureStyledTextWidth(parseAnsiToStyledText(props.state.content, props.config.terminalPalette)),
  );

  return (
    <scrollbox
      ref={(el: ScrollBoxRenderable) => props.registerScrollbox(el)}
      width="100%"
      height="100%"
      scrollX
      scrollY
      backgroundColor={colors.chromeFillOne}
      contentOptions={{
        width: contentWidth(),
        maxWidth: undefined,
      }}
      scrollbarOptions={buildScrollbarTrackOptions(
        colors.chromeFillThree,
        colors.chromeScrollbarThumb,
      )}
    >
      <box flexDirection="column" width={contentWidth()}>
        <For each={lines()}>
          {(line) => <DiffLine line={line} config={props.config} />}
        </For>
      </box>
    </scrollbox>
  );
}

function DiffLine(props: {
  line: DiffLineViewModel;
  config: ResolvedAppConfig;
}) {
  let textRef: any;

  createEffect(() => {
    if (textRef) {
      textRef.content = props.line.styledText;
    }
  });

  const colors = props.config.colorScheme.semanticColors;

  return (
    <box width="100%" height={1} flexShrink={0}>
      <text ref={textRef} fg={colors.textPrimary} wrapMode="none" />
    </box>
  );
}

function measureStyledTextWidth(styledText: StyledText): number {
  const textBuffer = TextBuffer.create("wcwidth");
  const textBufferView = TextBufferView.create(textBuffer);

  try {
    textBuffer.setStyledText(styledText);
    textBufferView.setWrapMode("none");

    return Math.max(1, textBufferView.measureForDimensions(0, 1)?.widthColsMax ?? 1);
  } finally {
    textBufferView.destroy();
    textBuffer.destroy();
  }
}

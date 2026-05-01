import type { ScrollBoxRenderable } from "@opentui/core";
import { For, createEffect, createMemo } from "solid-js";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { DiffViewerState } from "../domain/types.ts";
import { parseAnsiToStyledText } from "./ansiToStyledText.ts";

export function DiffViewer(props: {
  state: DiffViewerState;
  config: ResolvedAppConfig;
  registerScrollbox: (el: ScrollBoxRenderable | undefined) => void;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const lines = createMemo(() => props.state.content.split("\n"));

  return (
    <scrollbox
      ref={(el: ScrollBoxRenderable) => props.registerScrollbox(el)}
      width="100%"
      height="100%"
      scrollX
      scrollY
      backgroundColor={colors.chromeFillOne}
      scrollbarOptions={{
        trackOptions: {
          backgroundColor: colors.chromeFillThree,
          foregroundColor: colors.chromeScrollbarThumb,
        },
      }}
    >
      <box flexDirection="column">
        <For each={lines()}>
          {(line) => <DiffLine line={line} config={props.config} />}
        </For>
      </box>
    </scrollbox>
  );
}

function DiffLine(props: {
  line: string;
  config: ResolvedAppConfig;
}) {
  let textRef: any;

  const styledText = createMemo(() =>
    parseAnsiToStyledText(props.line, props.config.terminalPalette),
  );

  createEffect(() => {
    if (textRef) {
      textRef.content = styledText();
    }
  });

  const colors = props.config.colorScheme.semanticColors;

  return (
    <box height={1} flexShrink={0}>
      <text ref={textRef} fg={colors.textPrimary} wrapMode="none" />
    </box>
  );
}

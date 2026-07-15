import { createEffect, createMemo } from "solid-js";
import { MouseButton, type MouseEvent } from "@opentui/core";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { OperationLogEntry } from "../domain/types.ts";
import { parseAnsiToStyledText } from "./ansiToStyledText.ts";
import { getRevisionRowBackgroundColor } from "./rowBackgrounds.ts";

function OperationLogAnsiLine(props: Readonly<{
  line: string;
  backgroundColor: string | undefined;
  config: ResolvedAppConfig;
}>) {
  let textRef: any;

  createEffect(() => {
    if (textRef) {
      textRef.content = parseAnsiToStyledText(props.line, props.config.terminalPalette);
    }
  });

  return (
    <box width="100%" height={1} overflow="hidden" backgroundColor={props.backgroundColor}>
      <text
        ref={textRef}
        width="100%"
        fg={props.config.colorScheme.semanticColors.textPrimary}
        wrapMode="none"
        truncate
      />
    </box>
  );
}

export function OperationLogEntryItem(props: Readonly<{
  entry: OperationLogEntry;
  focused: boolean;
  config: ResolvedAppConfig;
  id?: string;
  onMouseFocus?: () => void;
}>) {
  const backgroundColor = createMemo(() =>
    getRevisionRowBackgroundColor({
      focused: props.focused,
      selected: false,
      pinnedTarget: false,
      affected: false,
      colors: props.config.colorScheme.semanticColors,
    })
  );

  return (
    <box
      id={props.id}
      width="100%"
      flexDirection="column"
      backgroundColor={backgroundColor()}
      onMouseDown={(event: MouseEvent) => {
        if (event.button !== MouseButton.LEFT) return;
        props.onMouseFocus?.();
      }}
    >
      {props.entry.lines.map((line) => (
        <OperationLogAnsiLine
          line={line}
          backgroundColor={backgroundColor()}
          config={props.config}
        />
      ))}
    </box>
  );
}
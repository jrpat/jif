import { createEffect, createMemo } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ResolvedAppConfig } from "../config/schema.ts";
import { parseAnsiToStyledText } from "./ansiToStyledText.ts";
import { makeScrollAcceleration } from "./scrollAcceleration.ts";
import { buildScrollbarTrackOptions } from "./scrollbarOptions.ts";

export function ScrollableAnsiBody(props: Readonly<{
  text: string;
  bodyHeight: number;
  config: ResolvedAppConfig;
  backgroundColor?: string;
  id?: string;
  registerScrollbox?: (el: ScrollBoxRenderable) => void;
  onMouseScroll?: () => void;
}>) {
  const colors = () => props.config.colorScheme.semanticColors;
  const scrollAcceleration = createMemo(() =>
    makeScrollAcceleration(props.config.scroll.step, props.config.scroll.acceleration)
  );
  let textRef: any;

  createEffect(() => {
    if (textRef) {
      textRef.content = parseAnsiToStyledText(props.text, props.config.terminalPalette);
    }
  });

  return (
    <scrollbox
      id={props.id}
      ref={(el: ScrollBoxRenderable) => props.registerScrollbox?.(el)}
      width="100%"
      height={props.bodyHeight}
      scrollX
      scrollY
      backgroundColor={props.backgroundColor}
      scrollAcceleration={scrollAcceleration()}
      scrollbarOptions={buildScrollbarTrackOptions(
        colors().chromeFillThree,
        colors().chromeScrollbarThumb,
      )}
      onMouseScroll={props.onMouseScroll}
    >
      <text ref={textRef} fg={colors().textPrimary} wrapMode="none" />
    </scrollbox>
  );
}

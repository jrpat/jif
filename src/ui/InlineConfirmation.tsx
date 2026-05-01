import { For } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { InlineConfirmationOptionId } from "../domain/types.ts";

const optionLabels: Readonly<Record<InlineConfirmationOptionId, string>> = {
  yes: "Yes",
  interactive: "Interactive",
  no: "No",
};

export function InlineConfirmation(props: {
  config: ResolvedAppConfig;
  message: string;
  options: readonly InlineConfirmationOptionId[];
  selectedOption: InlineConfirmationOptionId;
}) {
  const colors = props.config.colorScheme.semanticColors;

  return (
    <box
      width="100%"
      flexDirection="column"
      paddingX={1}
      border
      borderStyle="single"
      borderColor={colors.textPrimary}
      backgroundColor={colors.chromeFillTwo}
    >
      <box width="100%" flexDirection="row" flexWrap="wrap" backgroundColor={colors.chromeFillTwo}>
        <box flexDirection="row" flexShrink={0}>
          <text fg={colors.textPrimary}>{props.message}</text>
        </box>
        <box flexGrow={1} minWidth={0} />
        <box flexDirection="row" flexShrink={0} gap={1} backgroundColor={colors.chromeFillTwo}>
          <For each={props.options}>
            {(option) => {
              const selected = option === props.selectedOption;
              return (
                <text
                  fg={colors.textPrimary}
                  wrapMode="none"
                  attributes={selected ? TextAttributes.BOLD | TextAttributes.INVERSE : undefined}
                >
                  {optionLabels[option]}
                </text>
              );
            }}
          </For>
        </box>
      </box>
    </box>
  );
}

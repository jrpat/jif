import { For, createSignal } from "solid-js";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { OperationLogEntry } from "../../src/domain/types.ts";
import { OperationLogEntryItem } from "../../src/ui/OperationLogEntryItem.tsx";

const config = resolveAppConfig({ commands: { layout: "loose" } });

type CapturedSpans = Awaited<ReturnType<typeof testRender>>["captureSpans"] extends () => infer T ? T : never;
type CapturedSpan = CapturedSpans["lines"][number]["spans"][number];

function findSpan(frame: CapturedSpans, text: string): CapturedSpan {
  const span = frame.lines
    .flatMap((line) => line.spans)
    .find((candidate) => candidate.text.includes(text));

  if (!span) {
    throw new Error(`Expected to find span containing ${text}.`);
  }

  return span;
}

const entries: readonly OperationLogEntry[] = [
  { id: "65d964491fc0", lines: ["65d964491fc0 first"] },
  { id: "96df2f0afa0c", lines: ["96df2f0afa0c second"] },
];

let setFocusedIndex!: (value: number) => void;

const rendered = await testRender(() => {
  const [focusedIndex, updateFocusedIndex] = createSignal(0);
  setFocusedIndex = updateFocusedIndex;

  return (
    <box width={36} flexDirection="column">
      <For each={entries}>
        {(entry, index) => (
          <OperationLogEntryItem
            id={`operation-log-entry-${index()}`}
            entry={entry}
            focused={focusedIndex() === index()}
            config={config}
          />
        )}
      </For>
    </box>
  );
}, { width: 36, height: 6 });

await rendered.renderOnce();
const initialSpans = rendered.captureSpans();
const firstInitialBg = findSpan(initialSpans, "65d964491fc0").bg.toInts();
const secondInitialBg = findSpan(initialSpans, "96df2f0afa0c").bg.toInts();

setFocusedIndex(1);
await rendered.renderOnce();
const afterSpans = rendered.captureSpans();
const firstAfterBg = findSpan(afterSpans, "65d964491fc0").bg.toInts();
const secondAfterBg = findSpan(afterSpans, "96df2f0afa0c").bg.toInts();

rendered.renderer.destroy();

console.log(JSON.stringify({
  firstInitialBg,
  secondInitialBg,
  firstAfterBg,
  secondAfterBg,
}));
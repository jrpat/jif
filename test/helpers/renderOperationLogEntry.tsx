import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { OperationLogEntry } from "../../src/domain/types.ts";
import { OperationLogEntryItem } from "../../src/ui/OperationLogEntryItem.tsx";

const config = resolveAppConfig({ commands: { layout: "expanded" } });

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

const entry: OperationLogEntry = {
  id: "65d964491fc0",
  lines: [
    "\u001b[1m\u001b[38;5;12m65d964491fc0\u001b[39m\u001b[0m jrpat@host jif-3@ 9 minutes ago",
    "rebase commit 93f155d4a5345ccc3eb97e649e3ee0eab8878180 and 1 more",
    "\u001b[38;5;13margs:\u001b[39m jj --color always rebase -r q -r xm -d n",
  ],
};

const rendered = await testRender(() => (
  <box width={36} flexDirection="column">
    <OperationLogEntryItem
      entry={entry}
      focused={true}
      config={config}
      id="operation-log-entry-0"
    />
  </box>
), { width: 36, height: 6 });

await rendered.renderOnce();

const frame = rendered.captureCharFrame();
const spans = rendered.captureSpans();
rendered.renderer.destroy();

const renderedLineCount = frame
  .trimEnd()
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .length;

const idSpan = findSpan(spans, "65d964491fc0");
const argsSpan = findSpan(spans, "args:");

console.log(JSON.stringify({
  frame,
  renderedLineCount,
  idFg: idSpan.fg.toInts(),
  argsFg: argsSpan.fg.toInts(),
  idBg: idSpan.bg.toInts(),
}));